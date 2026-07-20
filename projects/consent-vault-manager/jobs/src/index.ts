import { Queue, Worker, type Job } from "bullmq";

import { createRealRepositories } from "../../apps/api/src/consent-vault/create-real-repositories.js";
import { runBreachNoticeDraft, type BreachNoticeDraftJobData } from "./breachNoticeDraft.js";
import {
  DSR_SLA_ESCALATION_INTERVAL_MS,
  EXPIRY_SWEEP_INTERVAL_MS,
  REDIS_CONNECTION,
  WEEKLY_COMPLIANCE_REPORT_INTERVAL_MS,
} from "./config.js";
import { recordConfirmedNotification } from "./confirmNotification.js";
import { runDsrSlaEscalation, type DsrSlaThreshold } from "./dsrSlaEscalation.js";
import { runExpirySweep } from "./expirySweep.js";
import { logConfirmed } from "./notify.js";
import type { ConfirmedNotificationJobData, PendingAction } from "./pendingActions.js";
import {
  BREACH_NOTICE_DRAFT_QUEUE,
  DSR_SLA_ESCALATION_QUEUE,
  EXPIRY_SWEEP_QUEUE,
  NOTIFICATION_CONFIRMED_QUEUE,
  PENDING_NOTIFICATIONS_QUEUE,
  WEEKLY_COMPLIANCE_REPORT_QUEUE,
  WITHDRAWAL_CASCADE_QUEUE,
} from "./queues.js";
import { runWeeklyComplianceReport } from "./weeklyComplianceReport.js";
import { runWithdrawalCascade, type WithdrawalCascadeJobData } from "./withdrawalCascade.js";

/**
 * Phase 5 cutover: one connected PrismaService (and the three repositories
 * built on it) for the lifetime of this process, shared by every job
 * processor via closure — same reasoning as Phase 0-3's single
 * InMemoryConsentVaultStore had: state needs to persist across ticks, not
 * reset on every run. The difference now is Postgres itself holds that
 * state, not this process's memory, so it also survives a restart.
 */
const { prisma, consent, dsr, ledger } = await createRealRepositories();
console.log(`[jobs] starting against the real Postgres-backed repositories (pid ${process.pid})`);

const pendingQueue = new Queue<PendingAction>(PENDING_NOTIFICATIONS_QUEUE, { connection: REDIS_CONNECTION });
async function stagePendingAction(action: PendingAction) {
  await pendingQueue.add(action.kind, action);
}

/**
 * Dedup check for DSR SLA escalations (see dsrSlaEscalation.ts's header
 * comment on why this callback exists instead of a status-change hook):
 * "already handled" means either still sitting unconfirmed in the pending
 * queue, or already confirmed on the ledger with this exact threshold.
 */
async function hasPendingOrSentDsrEscalation(dsrRequestId: string, threshold: DsrSlaThreshold): Promise<boolean> {
  const pending = await pendingQueue.getJobs(["waiting", "delayed"]);
  const alreadyPending = pending.some(
    (job) => job.data.kind === "dsr_escalation_email" && job.data.refId === dsrRequestId && job.data.threshold === threshold,
  );
  if (alreadyPending) return true;

  const entries = await ledger.listEntries({ refId: dsrRequestId, entryType: "dsr_escalation_sent" });
  return entries.some((entry) => entry.detail.threshold === threshold);
}

const expirySweepQueue = new Queue(EXPIRY_SWEEP_QUEUE, { connection: REDIS_CONNECTION });
await expirySweepQueue.add(
  "sweep",
  {},
  {
    repeat: { every: EXPIRY_SWEEP_INTERVAL_MS },
    // Stable jobId so restarting this process doesn't register a second
    // duplicate repeatable schedule alongside the existing one.
    jobId: "expiry-sweep-repeatable",
  },
);
console.log(`[jobs] expiry sweep scheduled every ${EXPIRY_SWEEP_INTERVAL_MS}ms`);

const expirySweepWorker = new Worker(
  EXPIRY_SWEEP_QUEUE,
  async () => {
    const result = await runExpirySweep(consent, stagePendingAction);
    console.log(
      `[expiry-sweep] checked at ${result.checkedAt.toISOString()} — ${result.expired.length} artifact(s) expired` +
        (result.expired.length > 0 ? ` (${result.expired.join(", ")})` : ""),
    );
    return result;
  },
  { connection: REDIS_CONNECTION },
);

const dsrSlaEscalationQueue = new Queue(DSR_SLA_ESCALATION_QUEUE, { connection: REDIS_CONNECTION });
await dsrSlaEscalationQueue.add(
  "sweep",
  {},
  { repeat: { every: DSR_SLA_ESCALATION_INTERVAL_MS }, jobId: "dsr-sla-escalation-repeatable" },
);
console.log(`[jobs] DSR SLA escalation scheduled every ${DSR_SLA_ESCALATION_INTERVAL_MS}ms`);

const dsrSlaEscalationWorker = new Worker(
  DSR_SLA_ESCALATION_QUEUE,
  async () => {
    const result = await runDsrSlaEscalation(dsr, hasPendingOrSentDsrEscalation, stagePendingAction);
    console.log(
      `[dsr-sla-escalation] checked at ${result.checkedAt.toISOString()} — ${result.escalated.length} reminder(s) staged` +
        (result.escalated.length > 0
          ? ` (${result.escalated.map((e) => `${e.dsrRequestId}:${e.threshold}`).join(", ")})`
          : ""),
    );
    return result;
  },
  { connection: REDIS_CONNECTION },
);

const weeklyComplianceReportQueue = new Queue(WEEKLY_COMPLIANCE_REPORT_QUEUE, { connection: REDIS_CONNECTION });
await weeklyComplianceReportQueue.add(
  "generate",
  {},
  { repeat: { every: WEEKLY_COMPLIANCE_REPORT_INTERVAL_MS }, jobId: "weekly-compliance-report-repeatable" },
);
console.log(`[jobs] weekly compliance report scheduled every ${WEEKLY_COMPLIANCE_REPORT_INTERVAL_MS}ms`);

const weeklyComplianceReportWorker = new Worker(
  WEEKLY_COMPLIANCE_REPORT_QUEUE,
  async () => {
    const result = await runWeeklyComplianceReport(ledger, stagePendingAction);
    console.log(
      `[weekly-compliance-report] ${result.from.toISOString()} – ${result.to.toISOString()} — ${result.pdfBytes} byte PDF staged`,
    );
    return result;
  },
  { connection: REDIS_CONNECTION },
);

const withdrawalCascadeWorker = new Worker<WithdrawalCascadeJobData>(
  WITHDRAWAL_CASCADE_QUEUE,
  async (job: Job<WithdrawalCascadeJobData>) => {
    const result = await runWithdrawalCascade(consent, job.data, stagePendingAction);
    console.log(
      `[withdrawal-cascade] consent ${result.consentId} — ${result.flaggedProcessorIds.length} processor(s) flagged for purge` +
        (result.flaggedProcessorIds.length > 0 ? ` (${result.flaggedProcessorIds.join(", ")})` : ""),
    );
    return result;
  },
  { connection: REDIS_CONNECTION },
);

/**
 * Consumes BREACH_NOTICE_DRAFT_QUEUE, which mcp-server's report_breach_event
 * tool produces onto directly after writing a high/critical-severity
 * BreachEvent (see queues.ts's header comment on that queue).
 */
const breachNoticeDraftWorker = new Worker<BreachNoticeDraftJobData>(
  BREACH_NOTICE_DRAFT_QUEUE,
  async (job: Job<BreachNoticeDraftJobData>) => {
    const result = await runBreachNoticeDraft(consent, ledger, job.data, stagePendingAction);
    console.log(
      `[breach-notice-draft] breach ${result.breachEventId} — ` +
        `${result.affectedPurposeCount} purpose(s), ~${result.affectedPrincipalCount} affected principal(s)`,
    );
    return result;
  },
  { connection: REDIS_CONNECTION },
);

/**
 * Processes confirmations from scripts/confirm-notification.ts. Runs inside
 * this same process — the only one holding the real repository instances —
 * so the ledger entry lands next to the state mutation the original job made.
 */
const notificationConfirmedWorker = new Worker<ConfirmedNotificationJobData>(
  NOTIFICATION_CONFIRMED_QUEUE,
  async (job: Job<ConfirmedNotificationJobData>) => {
    const entry = await recordConfirmedNotification(ledger, job.data);
    logConfirmed(
      `${job.data.pending.kind} for ${job.data.pending.refId} -> ledger entry ${entry.id} (seq ${entry.sequence})`,
    );
    return entry;
  },
  { connection: REDIS_CONNECTION },
);

function attachFailureLogger(label: string, worker: Worker) {
  worker.on("failed", (job, err) => {
    console.error(`[${label}] job ${job?.id ?? "unknown"} failed:`, err);
  });
}
attachFailureLogger("expiry-sweep", expirySweepWorker);
attachFailureLogger("dsr-sla-escalation", dsrSlaEscalationWorker);
attachFailureLogger("weekly-compliance-report", weeklyComplianceReportWorker);
attachFailureLogger("withdrawal-cascade", withdrawalCascadeWorker);
attachFailureLogger("breach-notice-draft", breachNoticeDraftWorker);
attachFailureLogger("notification-confirmed", notificationConfirmedWorker);

await Promise.all([
  expirySweepWorker.waitUntilReady(),
  dsrSlaEscalationWorker.waitUntilReady(),
  weeklyComplianceReportWorker.waitUntilReady(),
  withdrawalCascadeWorker.waitUntilReady(),
  breachNoticeDraftWorker.waitUntilReady(),
  notificationConfirmedWorker.waitUntilReady(),
]);
console.log("[jobs] workers ready");

async function shutdown() {
  console.log("\n[jobs] shutting down...");
  await Promise.all([
    expirySweepWorker.close(),
    dsrSlaEscalationWorker.close(),
    weeklyComplianceReportWorker.close(),
    withdrawalCascadeWorker.close(),
    breachNoticeDraftWorker.close(),
    notificationConfirmedWorker.close(),
    expirySweepQueue.close(),
    dsrSlaEscalationQueue.close(),
    weeklyComplianceReportQueue.close(),
    pendingQueue.close(),
    prisma.$disconnect(),
  ]);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
