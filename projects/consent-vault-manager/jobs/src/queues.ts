export const EXPIRY_SWEEP_QUEUE = "expiry-sweep";
export const WITHDRAWAL_CASCADE_QUEUE = "withdrawal-cascade";
/** Drafted email/calendar actions waiting on a human to confirm before anything real is created. */
export const PENDING_NOTIFICATIONS_QUEUE = "pending-notifications";
/** A human confirmed a pending action and provided the real Gmail draft / Calendar event id. */
export const NOTIFICATION_CONFIRMED_QUEUE = "notification-confirmed";
