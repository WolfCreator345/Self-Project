import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Queue } from "bullmq";

import { PrismaService } from "../../apps/api/src/prisma/prisma.service.js";
import { resetDatabase } from "../../apps/api/test/test-db.js";
import { REDIS_CONNECTION } from "../src/config.js";
import type { ConfirmedNotificationJobData, PendingAction } from "../src/pendingActions.js";
import {
  EXPIRY_SWEEP_QUEUE,
  NOTIFICATION_CONFIRMED_QUEUE,
  PENDING_NOTIFICATIONS_QUEUE,
  WITHDRAWAL_CASCADE_QUEUE,
} from "../src/queues.js";

/**
 * Spawns the real worker process (same tsx entry point `npm start` uses),
 * then drives it entirely through Redis — exactly as a human running
 * `npm start` in one terminal and the CLI scripts in another would. Not a
 * typecheck: a real BullMQ queue -> worker -> Postgres round trip (Phase 5
 * cutover; this used to run against mock-store), including the Phase 3
 * staging/confirmation loop, verified by reading the worker's own log
 * output. Uses fake gmail-draft-id/calendar-event-id values — it does not
 * touch real Gmail/Calendar, unlike an actual human confirmation via Claude
 * Code. Requires Redis and Postgres running locally (see README). Reseeds
 * Postgres first since — unlike the old ephemeral mock store — real data
 * persists across worker restarts, so consent-12/consent-4 need to be back
 * in their fresh seeded state for this to be repeatable.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jobsDir = path.resolve(__dirname, "..");

function waitFor(getBuffer: () => string, substring: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (getBuffer().includes(substring)) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(
          new Error(`Timed out after ${timeoutMs}ms waiting for log containing: ${substring}\n--- captured output ---\n${getBuffer()}`),
        );
      }
    }, 100);
  });
}

/** Mirrors what scripts/confirm-notification.ts does, but with a fake id instead of a real Gmail/Calendar one. */
async function confirmWithFakeId(pendingQueue: Queue<PendingAction>, jobId: string, action: PendingAction) {
  const confirmedQueue = new Queue<ConfirmedNotificationJobData>(NOTIFICATION_CONFIRMED_QUEUE, {
    connection: REDIS_CONNECTION,
  });
  const isCalendar = action.kind === "purge_followup_event";
  await confirmedQueue.add("confirmed", {
    pending: action,
    gmailDraftId: isCalendar ? undefined : "fake-draft-id",
    calendarEventId: isCalendar ? "fake-event-id" : undefined,
    confirmedAt: new Date().toISOString(),
  });
  const job = await pendingQueue.getJob(jobId);
  await job?.remove();
  await confirmedQueue.close();
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  await resetDatabase(prisma);
  await prisma.$disconnect();
  console.log("✓ reseeded the real Postgres database with mock-store's deterministic fixtures");

  let output = "";
  const child = spawn(path.join(jobsDir, "node_modules/.bin/tsx"), ["src/index.ts"], {
    cwd: jobsDir,
    env: process.env,
  });
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    process.stdout.write(`[worker] ${chunk}`);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    process.stderr.write(`[worker] ${chunk}`);
  });

  try {
    await waitFor(() => output, "[jobs] workers ready");
    console.log("✓ worker process started; all three BullMQ workers are ready");

    const pendingQueue = new Queue<PendingAction>(PENDING_NOTIFICATIONS_QUEUE, { connection: REDIS_CONNECTION });

    // Trigger an immediate, one-off expiry sweep tick (don't wait for the
    // 2-minute repeatable schedule) via the same queue the repeatable job uses.
    const expiryQueue = new Queue(EXPIRY_SWEEP_QUEUE, { connection: REDIS_CONNECTION });
    await expiryQueue.add("sweep-once", {});
    await expiryQueue.close();
    await waitFor(() => output, "[expiry-sweep] checked at");
    assert.ok(output.includes("consent-12"), "expected the seeded stale consent-12 to be swept");
    assert.ok(output.includes("[staged] renewal email"), "expected a staged renewal email log line");
    console.log("✓ expiry sweep ran through the real BullMQ queue/worker, expired consent-12, and staged a renewal email");

    // Confirm that one staged renewal email with a fake Gmail draft id — this is what
    // scripts/confirm-notification.ts does after a human actually creates the real draft.
    const staleRenewal = (await pendingQueue.getJobs(["waiting"])).find((j) => j.name === "renewal_email");
    assert.ok(staleRenewal, "expected a staged renewal_email pending job");
    await confirmWithFakeId(pendingQueue, staleRenewal!.id!, staleRenewal!.data);
    await waitFor(() => output, "[confirmed] renewal_email for consent-12");
    console.log("✓ confirming the staged renewal email wrote a ledger entry via the notification-confirmed queue");

    // Fire a withdrawal cascade event for a seeded withdrawn consent with processors.
    const cascadeQueue = new Queue(WITHDRAWAL_CASCADE_QUEUE, { connection: REDIS_CONNECTION });
    await cascadeQueue.add("withdrawal", { consentId: "consent-4" });
    await cascadeQueue.close();
    await waitFor(() => output, "[withdrawal-cascade] consent consent-4");
    assert.ok(output.includes("[staged] purge notice"), "expected staged purge notice log lines from the cascade");
    console.log("✓ withdrawal cascade ran through the real BullMQ queue/worker, flagged processors, and staged notices");

    // Confirm every pending item from the cascade (2 processors x email + calendar event = 4).
    const cascadePending = (await pendingQueue.getJobs(["waiting"])).filter(
      (j) => j.name === "purge_notice_email" || j.name === "purge_followup_event",
    );
    assert.equal(cascadePending.length, 4, "expected 4 pending items from the withdrawal cascade");
    for (const job of cascadePending) {
      await confirmWithFakeId(pendingQueue, job.id!, job.data);
    }
    await waitFor(() => output, "[confirmed] purge_followup_event for processor-6");
    const confirmedCount = output.split("[confirmed]").length - 1;
    assert.ok(confirmedCount >= 5, `expected at least 5 [confirmed] lines total, saw ${confirmedCount}`);
    console.log("✓ confirming all 4 cascade pending items wrote ledger entries (2 emails + 2 calendar events)");

    await pendingQueue.close();

    console.log("\nAll jobs smoke tests passed.");
  } finally {
    child.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
