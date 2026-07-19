import { Queue, Worker, type Job } from "bullmq";

import { createSeededStore } from "../../mock-store/index.js";
import { EXPIRY_SWEEP_INTERVAL_MS, REDIS_CONNECTION } from "./config.js";
import { runExpirySweep } from "./expirySweep.js";
import { EXPIRY_SWEEP_QUEUE, WITHDRAWAL_CASCADE_QUEUE } from "./queues.js";
import { runWithdrawalCascade, type WithdrawalCascadeJobData } from "./withdrawalCascade.js";

/**
 * One InMemoryConsentVaultStore instance for the lifetime of this process,
 * shared by both job processors via closure. Recreating it per job run
 * would reset state back to the seed on every tick — the whole point of
 * markExpired/markProcessorForPurge is that they persist across runs until
 * Phase 4 swaps this for the real Postgres-backed store.
 */
const store = createSeededStore();
console.log(`[jobs] starting against a freshly seeded mock store (pid ${process.pid})`);

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
    const result = await runExpirySweep(store);
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
    const result = await runWithdrawalCascade(store, job.data);
    console.log(
      `[withdrawal-cascade] consent ${result.consentId} — ${result.flaggedProcessorIds.length} processor(s) flagged for purge` +
        (result.flaggedProcessorIds.length > 0 ? ` (${result.flaggedProcessorIds.join(", ")})` : ""),
    );
    return result;
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

await Promise.all([expirySweepWorker.waitUntilReady(), withdrawalCascadeWorker.waitUntilReady()]);
console.log("[jobs] workers ready");

async function shutdown() {
  console.log("\n[jobs] shutting down...");
  await Promise.all([expirySweepWorker.close(), withdrawalCascadeWorker.close(), expirySweepQueue.close()]);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
