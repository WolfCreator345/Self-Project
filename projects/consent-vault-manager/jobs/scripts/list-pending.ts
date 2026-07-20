import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Queue } from "bullmq";

import { REDIS_CONNECTION } from "../src/config.js";
import type { PendingAction } from "../src/pendingActions.js";
import { PENDING_NOTIFICATIONS_QUEUE } from "../src/queues.js";

/**
 * Lists every drafted email/calendar/report action staged by the jobs but
 * not yet confirmed — the human review inbox. Read-only: only touches
 * Redis, so it can run from any terminal regardless of which process is
 * running the worker.
 *
 * weekly_report items carry their PDF inline as base64 (see
 * pendingActions.ts's PendingReportAction) — printing that raw would be an
 * unreadable wall of text, so it's decoded and written to a local temp file
 * instead, with the path printed for review/upload.
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
      if (job.data.kind === "weekly_report") {
        const { pdfBase64, ...rest } = job.data;
        const outPath = path.join(os.tmpdir(), job.data.pdfFilename);
        fs.writeFileSync(outPath, Buffer.from(pdfBase64, "base64"));
        console.log(JSON.stringify(rest, null, 2));
        console.log(`PDF written to: ${outPath}`);
      } else {
        console.log(JSON.stringify(job.data, null, 2));
      }
      console.log("");
    }
    console.log(
      "To confirm one after actually creating the real artifact:\n" +
        "  npm run confirm -- <pendingJobId> --gmail-draft-id=<id>\n" +
        "  npm run confirm -- <pendingJobId> --calendar-event-id=<id>\n" +
        "  npm run confirm -- <pendingJobId> --drive-file-id=<id>   (weekly_report needs this + --gmail-draft-id together)",
    );
  }

  await queue.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
