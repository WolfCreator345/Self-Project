import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Queue } from "bullmq";

import { REDIS_CONNECTION } from "../src/config.js";
import { EXPIRY_SWEEP_QUEUE, WITHDRAWAL_CASCADE_QUEUE } from "../src/queues.js";

/**
 * Spawns the real worker process (same tsx entry point `npm start` uses),
 * then drives it entirely through Redis — exactly as a human running
 * `npm start` in one terminal and `npm run fire:withdrawal` in another
 * would. Not a typecheck: a real BullMQ queue -> worker -> mock-store round
 * trip, verified by reading the worker's own log output. Requires Redis
 * running locally (see README).
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

async function main() {
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
    console.log("✓ worker process started; both BullMQ workers are ready");

    // Trigger an immediate, one-off expiry sweep tick (don't wait for the
    // 2-minute repeatable schedule) via the same queue the repeatable job uses.
    const expiryQueue = new Queue(EXPIRY_SWEEP_QUEUE, { connection: REDIS_CONNECTION });
    await expiryQueue.add("sweep-once", {});
    await expiryQueue.close();
    await waitFor(() => output, "[expiry-sweep] checked at");
    assert.ok(output.includes("consent-12"), "expected the seeded stale consent-12 to be swept");
    assert.ok(output.includes("[would email]"), "expected a would-email log line from the sweep");
    console.log("✓ expiry sweep ran through the real BullMQ queue/worker and expired consent-12");

    // Fire a withdrawal cascade event for a seeded withdrawn consent with processors.
    const cascadeQueue = new Queue(WITHDRAWAL_CASCADE_QUEUE, { connection: REDIS_CONNECTION });
    await cascadeQueue.add("withdrawal", { consentId: "consent-4" });
    await cascadeQueue.close();
    await waitFor(() => output, "[withdrawal-cascade] consent consent-4");
    assert.ok(output.includes("[would notify]"), "expected would-notify log lines from the cascade");
    console.log("✓ withdrawal cascade ran through the real BullMQ queue/worker and flagged processors");

    console.log("\nAll jobs smoke tests passed.");
  } finally {
    child.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
