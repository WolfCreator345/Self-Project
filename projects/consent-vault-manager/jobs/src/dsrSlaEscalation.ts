import type { DSRRepository } from "../../mock-store/index.js";
import { logStaged } from "./notify.js";
import type { PendingEmailAction, StagePendingAction } from "./pendingActions.js";

export type DsrSlaThreshold = "T-7d" | "T-2d";

const THRESHOLDS: { id: DsrSlaThreshold; days: number }[] = [
  { id: "T-7d", days: 7 },
  { id: "T-2d", days: 2 },
];

/**
 * Checks whether an escalation for this (dsrRequestId, threshold) pair has
 * already been staged (still pending confirmation, sitting in Redis) or
 * already confirmed (a dsr_escalation_sent ledger entry with this
 * threshold). Either state means "don't stage another one" — unlike
 * expiry/withdrawal, an SLA reminder doesn't change the DSRRequest's status,
 * so there's no entity-state-change to piggyback dedup on; this callback is
 * the dedup mechanism instead. Implemented in index.ts against the real
 * pending queue + ledger; unit tests inject an in-memory fake.
 */
export type HasPendingOrSentEscalation = (dsrRequestId: string, threshold: DsrSlaThreshold) => Promise<boolean>;

export interface DsrSlaEscalationResult {
  checkedAt: Date;
  escalated: { dsrRequestId: string; threshold: DsrSlaThreshold }[];
}

/**
 * Scans every not-yet-resolved DSRRequest and stages an internal "about to
 * miss an SLA" reminder (to the fiduciary's own inbox, never the data
 * principal) at T-7d and T-2d before dueAt. Complements the dashboard's
 * overdue flag (Phase 6, computed from dueAt already having passed) with a
 * proactive nudge before that happens. Pure function over a DSRRepository
 * (plus injected dedup-check and staging callbacks), unit-testable against
 * mock-store without Redis/Postgres.
 */
export async function runDsrSlaEscalation(
  dsr: DSRRepository,
  hasPendingOrSentEscalation: HasPendingOrSentEscalation,
  stagePendingAction: StagePendingAction,
): Promise<DsrSlaEscalationResult> {
  const selfEmail = process.env.SELF_NOTIFICATION_EMAIL;
  if (!selfEmail) {
    throw new Error("SELF_NOTIFICATION_EMAIL must be set — DSR SLA escalations go to the fiduciary's own inbox, not the data principal.");
  }

  const now = new Date();
  const requests = await dsr.listDSRRequests();
  const notResolved = requests.filter((request) => request.status !== "resolved");

  const escalated: { dsrRequestId: string; threshold: DsrSlaThreshold }[] = [];
  for (const request of notResolved) {
    const daysUntilDue = (request.dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);

    for (const { id: threshold, days } of THRESHOLDS) {
      if (daysUntilDue > days) continue;
      if (await hasPendingOrSentEscalation(request.id, threshold)) continue;

      const action: PendingEmailAction = {
        kind: "dsr_escalation_email",
        refId: request.id,
        principalId: request.principalId,
        recipientEmail: selfEmail,
        recipientName: "Data Protection Office",
        threshold,
        subject: `DSR SLA alert (${threshold}): ${request.type} request due ${request.dueAt.toDateString()}`,
        body:
          `DSR request ${request.id} (${request.type}, principal ${request.principalId}) is due ` +
          `${request.dueAt.toDateString()} and is still "${request.status}" — ` +
          `${Math.max(0, Math.ceil(daysUntilDue))} day(s) remaining.\n\n` +
          `This is a ${threshold} internal SLA reminder. Take action before it becomes overdue.`,
      };
      await stagePendingAction(action);
      escalated.push({ dsrRequestId: request.id, threshold });
      logStaged(`DSR SLA escalation (${threshold}) for ${request.id} — awaiting confirmation`);
    }
  }

  return { checkedAt: now, escalated };
}
