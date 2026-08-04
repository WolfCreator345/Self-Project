import { Queue } from "bullmq";

import { REDIS_CONNECTION } from "../src/config.js";
import type { ConfirmedNotificationJobData, PendingAction } from "../src/pendingActions.js";
import { NOTIFICATION_CONFIRMED_QUEUE, PENDING_NOTIFICATIONS_QUEUE } from "../src/queues.js";

function parseArg(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

/**
 * The manual confirmation gate. Run this only *after* the real Gmail draft
 * / Calendar event has actually been created (via Claude Code's own MCP
 * tool access, since this script itself has no Gmail/Calendar credentials)
 * — it records that it happened, it doesn't perform the send/create itself.
 *
 * Removes the item from the pending-notifications inbox and hands it to the
 * running `npm start` worker via the notification-confirmed queue, which is
 * the only place holding the real store instance to write the ledger entry
 * against.
 */
async function main() {
  const pendingJobId = process.argv[2];
  if (!pendingJobId) {
    console.error(
      "Usage: npm run confirm -- <pendingJobId> [--gmail-draft-id=<id>] [--calendar-event-id=<id>] [--drive-file-id=<id>]",
    );
    process.exitCode = 1;
    return;
  }

  const gmailDraftId = parseArg("gmail-draft-id");
  const calendarEventId = parseArg("calendar-event-id");
  const driveFileId = parseArg("drive-file-id");
  if (!gmailDraftId && !calendarEventId && !driveFileId) {
    console.error(
      "Provide at least one of --gmail-draft-id, --calendar-event-id, or --drive-file-id — " +
        "confirmation must reference the real artifact that was actually created. " +
        "(weekly_report needs both --gmail-draft-id and --drive-file-id together.)",
    );
    process.exitCode = 1;
    return;
  }

  const pendingQueue = new Queue<PendingAction>(PENDING_NOTIFICATIONS_QUEUE, { connection: REDIS_CONNECTION });
  const pendingJob = await pendingQueue.getJob(pendingJobId);
  if (!pendingJob) {
    console.error(`No pending notification with id "${pendingJobId}" (already confirmed, or never existed).`);
    process.exitCode = 1;
    await pendingQueue.close();
    return;
  }

  const confirmedQueue = new Queue<ConfirmedNotificationJobData>(NOTIFICATION_CONFIRMED_QUEUE, {
    connection: REDIS_CONNECTION,
  });
  await confirmedQueue.add("confirmed", {
    pending: pendingJob.data,
    gmailDraftId,
    calendarEventId,
    driveFileId,
    confirmedAt: new Date().toISOString(),
  });
  await pendingJob.remove();

  console.log(`Confirmed pending notification ${pendingJobId} (${pendingJob.name}).`);
  console.log("The running `npm start` worker will write the ledger entry — check its logs for [confirmed].");

  await Promise.all([pendingQueue.close(), confirmedQueue.close()]);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
