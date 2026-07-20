export const EXPIRY_SWEEP_QUEUE = "expiry-sweep";
export const WITHDRAWAL_CASCADE_QUEUE = "withdrawal-cascade";
/** Drafted email/calendar actions waiting on a human to confirm before anything real is created. */
export const PENDING_NOTIFICATIONS_QUEUE = "pending-notifications";
/** A human confirmed a pending action and provided the real Gmail draft / Calendar event id. */
export const NOTIFICATION_CONFIRMED_QUEUE = "notification-confirmed";
/**
 * Phase 7: mcp-server's report_breach_event tool enqueues onto this after
 * writing a high/critical-severity BreachEvent — a producer-only queue from
 * mcp-server's side, consumed by jobs/src/index.ts's long-running worker
 * (same "any process can produce, only the worker process holds live
 * repositories and actually staged" split as fire-withdrawal-event.ts).
 */
export const BREACH_NOTICE_DRAFT_QUEUE = "breach-notice-draft";
export const DSR_SLA_ESCALATION_QUEUE = "dsr-sla-escalation";
export const WEEKLY_COMPLIANCE_REPORT_QUEUE = "weekly-compliance-report";
