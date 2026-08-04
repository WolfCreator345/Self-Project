import { Queue } from "bullmq";

import { REDIS_CONNECTION } from "../src/config.js";
import { WITHDRAWAL_CASCADE_QUEUE } from "../src/queues.js";

/**
 * Manually fires a mock "consent revoked" event for the withdrawal cascade
 * worker to pick up. Run this while `npm start` is running in another
 * terminal (or via the smoke test) — this script only enqueues the job over
 * Redis, it doesn't touch the mock store directly, since that state lives
 * inside the long-running worker process.
 */
async function main() {
  const consentId = process.argv[2];
  if (!consentId) {
    console.error("Usage: npm run fire:withdrawal -- <consentId>");
    console.error('Example (seeded, withdrawn, purpose-4/analytics with 2 processors):');
    console.error("  npm run fire:withdrawal -- consent-4");
    process.exitCode = 1;
    return;
  }

  const queue = new Queue(WITHDRAWAL_CASCADE_QUEUE, { connection: REDIS_CONNECTION });
  const job = await queue.add("withdrawal", { consentId });
  console.log(`Fired withdrawal-cascade event for consent "${consentId}" (job ${job.id}).`);
  console.log("Check the running `npm start` worker's logs for [withdrawal-cascade] / [would notify] output.");
  await queue.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
