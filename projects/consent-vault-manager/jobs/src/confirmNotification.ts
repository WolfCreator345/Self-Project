import type { ConsentLedgerEntry, LedgerEntryType, LedgerRepository } from "../../mock-store/index.js";
import type { ConfirmedNotificationJobData, PendingActionKind } from "./pendingActions.js";
import type { ReportArchiver } from "./reportArchiver.js";

function ledgerEntryTypeFor(kind: PendingActionKind): LedgerEntryType {
  switch (kind) {
    case "renewal_email":
      return "renewal_email_drafted";
    case "purge_notice_email":
      return "purge_notice_email_drafted";
    case "purge_followup_event":
      return "purge_followup_event_scheduled";
    case "breach_notice_email":
      return "breach_notice_drafted";
    case "breach_notice_deadline":
      return "breach_notice_deadline_scheduled";
    case "dsr_escalation_email":
      return "dsr_escalation_sent";
    case "weekly_report":
      return "weekly_report_sent";
  }
}

/**
 * Writes the ledger entry for a notification/event a human has just
 * confirmed was actually created via the real Gmail/Calendar MCP tools.
 * This is the only place Phase 3 touches LedgerRepository for
 * notifications — every confirmed send/create ends up here, with the real
 * Gmail draft id / Calendar event id recorded for traceability. Pure
 * function over a LedgerRepository — mock-store's InMemoryConsentVaultStore
 * satisfies this for unit tests, PrismaLedgerRepository satisfies it for
 * the real notification-confirmed queue worker in index.ts.
 *
 * `reportArchiver` is only used for the `weekly_report` kind: archiving a
 * PDF is plain local I/O with no live MCP session required (unlike
 * Gmail/Calendar/Drive), so it happens right here at confirm time rather
 * than needing a human-supplied id the way `gmailDraftId`/`calendarEventId`
 * do. See reportArchiver.ts for why this is behind an interface.
 */
export async function recordConfirmedNotification(
  store: LedgerRepository,
  data: ConfirmedNotificationJobData,
  reportArchiver?: ReportArchiver,
): Promise<ConsentLedgerEntry> {
  const { pending, gmailDraftId, calendarEventId, confirmedAt } = data;

  let reportLocation: string | undefined;
  if (pending.kind === "weekly_report") {
    if (!gmailDraftId) {
      throw new Error("weekly_report confirmation requires gmailDraftId — the drafted email must actually exist before confirming.");
    }
    if (!reportArchiver) {
      throw new Error("weekly_report confirmation requires a ReportArchiver to archive the PDF.");
    }
    reportLocation = await reportArchiver.store(Buffer.from(pending.pdfBase64, "base64"), pending.pdfFilename);
  }

  return store.appendEntry({
    entryType: ledgerEntryTypeFor(pending.kind),
    refId: pending.refId,
    principalId: pending.principalId,
    detail: {
      messageType: pending.kind,
      recipientEmail: pending.recipientEmail,
      recipientName: pending.recipientName,
      ...(gmailDraftId ? { gmailDraftId } : {}),
      ...(calendarEventId ? { calendarEventId } : {}),
      ...(reportLocation ? { reportLocation } : {}),
      ...(pending.kind === "dsr_escalation_email" && pending.threshold ? { threshold: pending.threshold } : {}),
      confirmedAt,
    },
  });
}
