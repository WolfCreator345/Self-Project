import type { ConsentLedgerEntry, InMemoryConsentVaultStore, LedgerEntryType } from "../../mock-store/index.js";
import type { ConfirmedNotificationJobData, PendingActionKind } from "./pendingActions.js";

function ledgerEntryTypeFor(kind: PendingActionKind): LedgerEntryType {
  switch (kind) {
    case "renewal_email":
      return "renewal_email_drafted";
    case "purge_notice_email":
      return "purge_notice_email_drafted";
    case "purge_followup_event":
      return "purge_followup_event_scheduled";
  }
}

/**
 * Writes the ledger entry for a notification/event a human has just
 * confirmed was actually created via the real Gmail/Calendar MCP tools.
 * This is the only place Phase 3 touches LedgerRepository for
 * notifications — every confirmed send/create ends up here, with the real
 * Gmail draft id / Calendar event id recorded for traceability.
 */
export async function recordConfirmedNotification(
  store: InMemoryConsentVaultStore,
  data: ConfirmedNotificationJobData,
): Promise<ConsentLedgerEntry> {
  const { pending, gmailDraftId, calendarEventId, confirmedAt } = data;

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
      confirmedAt,
    },
  });
}
