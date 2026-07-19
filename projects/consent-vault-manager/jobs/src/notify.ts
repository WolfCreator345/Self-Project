/**
 * Phase 3: jobs draft real content and stage it on the pending-notifications
 * queue rather than sending directly — a headless worker has no Gmail/
 * Calendar credentials. This is just a progress log for what got staged;
 * the actual Gmail draft / Calendar event only exists once a human confirms
 * (see confirmNotification.ts and scripts/confirm-notification.ts).
 */

export function logStaged(message: string): void {
  console.log(`[staged] ${message}`);
}

export function logConfirmed(message: string): void {
  console.log(`[confirmed] ${message}`);
}
