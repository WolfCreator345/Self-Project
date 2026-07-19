/**
 * A job can't call Gmail/Calendar MCP directly — those connectors are only
 * reachable from an interactive Claude session, not a headless BullMQ
 * worker process. So instead of sending, a job drafts the content and
 * stages it here for a human (or Claude Code, acting on the human's
 * confirmation) to actually create via the real MCP tools, then confirm
 * back via ConfirmedNotificationJobData so the ledger entry gets written.
 */

export type PendingActionKind = "renewal_email" | "purge_notice_email" | "purge_followup_event";

interface PendingActionBase {
  /** ConsentArtifact id (renewal_email) or Processor id (purge_notice_email / purge_followup_event). */
  refId: string;
  principalId?: string;
  recipientEmail: string;
  recipientName: string;
}

export interface PendingEmailAction extends PendingActionBase {
  kind: "renewal_email" | "purge_notice_email";
  subject: string;
  body: string;
}

export interface PendingCalendarAction extends PendingActionBase {
  kind: "purge_followup_event";
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
}

export type PendingAction = PendingEmailAction | PendingCalendarAction;

/** Payload for the notification-confirmed queue, once a human has actually created the real artifact. */
export interface ConfirmedNotificationJobData {
  pending: PendingAction;
  gmailDraftId?: string;
  calendarEventId?: string;
  confirmedAt: string;
}

export type StagePendingAction = (action: PendingAction) => Promise<void>;
