import { Queue } from "bullmq";

import { REDIS_CONNECTION } from "../src/config.js";
import type { PendingAction } from "../src/pendingActions.js";
import { PENDING_NOTIFICATIONS_QUEUE } from "../src/queues.js";

/**
 * Lists every drafted email/calendar action staged by the jobs but not yet
 * confirmed — the human review inbox. Read-only: only touches Redis, so it
 * can run from any terminal regardless of which process is running the
 * worker.
 */
async function main() {
  const queue = new Queue<PendingAction>(PENDING_NOTIFICATIONS_QUEUE, { connection: REDIS_CONNECTION });
  const jobs = await queue.getJobs(["waiting", "delayed"]);

  if (jobs.length === 0) {
    console.log("No pending notifications awaiting confirmation.");
  } else {
    console.log(`${jobs.length} pending notification(s) awaiting confirmation:\n`);
    for (const job of jobs) {
      console.log(`--- pending #${job.id} (${job.name}) ---`);
      console.log(JSON.stringify(job.data, null, 2));
      console.log("");
    }
    console.log(
      "To confirm one after actually creating the real artifact:\n" +
        "  npm run confirm -- <pendingJobId> --gmail-draft-id=<id>\n" +
        "  npm run confirm -- <pendingJobId> --calendar-event-id=<id>",
    );
  }

  await queue.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
