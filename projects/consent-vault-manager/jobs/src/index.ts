import { Queue, Worker, type Job } from "bullmq";

import { createSeededStore } from "../../mock-store/index.js";
import { EXPIRY_SWEEP_INTERVAL_MS, REDIS_CONNECTION } from "./config.js";
import { recordConfirmedNotification } from "./confirmNotification.js";
import { runExpirySweep } from "./expirySweep.js";
import { logConfirmed } from "./notify.js";
import type { ConfirmedNotificationJobData, PendingAction } from "./pendingActions.js";
import {
  EXPIRY_SWEEP_QUEUE,
  NOTIFICATION_CONFIRMED_QUEUE,
  PENDING_NOTIFICATIONS_QUEUE,
  WITHDRAWAL_CASCADE_QUEUE,
} from "./queues.js";
import { runWithdrawalCascade, type WithdrawalCascadeJobData } from "./withdrawalCascade.js";

/**
 * One InMemoryConsentVaultStore instance for the lifetime of this process,
 * shared by every job processor via closure. Recreating it per job run
 * would reset state back to the seed on every tick — the whole point of
 * markExpired/markProcessorForPurge/appendEntry is that they persist across
 * runs until Phase 4 swaps this for the real Postgres-backed store.
 */
const store = createSeededStore();
console.log(`[jobs] starting against a freshly seeded mock store (pid ${process.pid})`);

const pendingQueue = new Queue<PendingAction>(PENDING_NOTIFICATIONS_QUEUE, { connection: REDIS_CONNECTION });
async function stagePendingAction(action: PendingAction) {
  await pendingQueue.add(action.kind, action);
}

const expirySweepQueue = new Queue(EXPIRY_SWEEP_QUEUE, { connection: REDIS_CONNECTION });
await expirySweepQueue.add(
  "sweep",
  {},
  {
    repeat: { every: EXPIRY_SWEEP_INTERVAL_MS },
    // Stable jobId so restarting this process doesn't register a second
    // duplicate repeatable schedule alongside the existing one.
    jobId: "expiry-sweep-repeatable",
  },
);
console.log(`[jobs] expiry sweep scheduled every ${EXPIRY_SWEEP_INTERVAL_MS}ms`);

const expirySweepWorker = new Worker(
  EXPIRY_SWEEP_QUEUE,
  async () => {
    const result = await runExpirySweep(store, stagePendingAction);
    console.log(
      `[expiry-sweep] checked at ${result.checkedAt.toISOString()} — ${result.expired.length} artifact(s) expired` +
        (result.expired.length > 0 ? ` (${result.expired.join(", ")})` : ""),
    );
    return result;
  },
  { connection: REDIS_CONNECTION },
);

const withdrawalCascadeWorker = new Worker<WithdrawalCascadeJobData>(
  WITHDRAWAL_CASCADE_QUEUE,
  async (job: Job<WithdrawalCascadeJobData>) => {
    const result = await runWithdrawalCascade(store, job.data, stagePendingAction);
    console.log(
      `[withdrawal-cascade] consent ${result.consentId} — ${result.flaggedProcessorIds.length} processor(s) flagged for purge` +
        (result.flaggedProcessorIds.length > 0 ? ` (${result.flaggedProcessorIds.join(", ")})` : ""),
    );
    return result;
  },
  { connection: REDIS_CONNECTION },
);

/**
 * Processes confirmations from scripts/confirm-notification.ts. Runs inside
 * this same process — the only one holding the real store instance — so the
 * ledger entry lands next to the state mutation the original job made.
 */
const notificationConfirmedWorker = new Worker<ConfirmedNotificationJobData>(
  NOTIFICATION_CONFIRMED_QUEUE,
  async (job: Job<ConfirmedNotificationJobData>) => {
    const entry = await recordConfirmedNotification(store, job.data);
    logConfirmed(
      `${job.data.pending.kind} for ${job.data.pending.refId} -> ledger entry ${entry.id} (seq ${entry.sequence})`,
    );
    return entry;
  },
  { connection: REDIS_CONNECTION },
);

function attachFailureLogger(label: string, worker: Worker) {
  worker.on("failed", (job, err) => {
    console.error(`[${label}] job ${job?.id ?? "unknown"} failed:`, err);
  });
}
attachFailureLogger("expiry-sweep", expirySweepWorker);
attachFailureLogger("withdrawal-cascade", withdrawalCascadeWorker);
attachFailureLogger("notification-confirmed", notificationConfirmedWorker);

await Promise.all([
  expirySweepWorker.waitUntilReady(),
  withdrawalCascadeWorker.waitUntilReady(),
  notificationConfirmedWorker.waitUntilReady(),
]);
console.log("[jobs] workers ready");

async function shutdown() {
  console.log("\n[jobs] shutting down...");
  await Promise.all([
    expirySweepWorker.close(),
    withdrawalCascadeWorker.close(),
    notificationConfirmedWorker.close(),
    expirySweepQueue.close(),
    pendingQueue.close(),
  ]);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
