/**
 * A job can't call Gmail/Calendar MCP directly — those connectors are only
 * reachable from an interactive Claude session, not a headless BullMQ
 * worker process. So instead of sending, a job drafts the content and
 * stages it here for a human (or Claude Code, acting on the human's
 * confirmation) to actually create via the real MCP tools, then confirm
 * back via ConfirmedNotificationJobData so the ledger entry gets written.
 */

import type { DsrSlaThreshold } from "./dsrSlaEscalation.js";

export type PendingActionKind =
  | "renewal_email"
  | "purge_notice_email"
  | "purge_followup_event"
  | "breach_notice_email"
  | "breach_notice_deadline"
  | "dsr_escalation_email"
  | "weekly_report";

interface PendingActionBase {
  /**
   * ConsentArtifact id (renewal_email), Processor id (purge_notice_email /
   * purge_followup_event), BreachEvent id (breach_notice_email /
   * breach_notice_deadline), DSRRequest id (dsr_escalation_email), or a
   * synthetic "weekly-report-<from>-<to>" id (weekly_report — there's no
   * single entity a report describes).
   */
  refId: string;
  principalId?: string;
  recipientEmail: string;
  recipientName: string;
}

export interface PendingEmailAction extends PendingActionBase {
  kind: "renewal_email" | "purge_notice_email" | "breach_notice_email" | "dsr_escalation_email";
  subject: string;
  body: string;
  /** dsr_escalation_email only — which SLA window triggered this reminder, also the dedup key. */
  threshold?: DsrSlaThreshold;
}

export interface PendingCalendarAction extends PendingActionBase {
  kind: "purge_followup_event" | "breach_notice_deadline";
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
}

/**
 * Phase 7's weekly compliance report: the draft carries the rendered PDF
 * inline (base64) — a one-page compliance snapshot is small enough to fit
 * comfortably in a BullMQ job payload — rather than writing to a shared
 * filesystem between the job process and whatever process later confirms
 * it, which may not be the same machine.
 */
export interface PendingReportAction extends PendingActionBase {
  kind: "weekly_report";
  subject: string;
  body: string;
  pdfBase64: string;
  pdfFilename: string;
}

export type PendingAction = PendingEmailAction | PendingCalendarAction | PendingReportAction;

/** Payload for the notification-confirmed queue, once a human has actually created the real artifact. */
export interface ConfirmedNotificationJobData {
  pending: PendingAction;
  gmailDraftId?: string;
  calendarEventId?: string;
  /**
   * Google Drive file id. Currently unused — weekly_report archival is
   * local-only until the Drive connector's create_file regression is fixed
   * (see reportArchiver.ts) — but kept on the type and accepted by
   * scripts/confirm-notification.ts's --drive-file-id flag so a future
   * Drive-backed ReportArchiver can start consuming it without a payload
   * shape change.
   */
  driveFileId?: string;
  confirmedAt: string;
}

export type StagePendingAction = (action: PendingAction) => Promise<void>;
