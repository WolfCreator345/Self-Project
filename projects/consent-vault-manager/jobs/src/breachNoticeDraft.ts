import type { ConsentRepository, LedgerRepository } from "../../mock-store/index.js";
import { logStaged } from "./notify.js";
import type { PendingCalendarAction, PendingEmailAction, StagePendingAction } from "./pendingActions.js";

export interface BreachNoticeDraftJobData {
  breachEventId: string;
}

export interface BreachNoticeDraftResult {
  breachEventId: string;
  affectedPurposeCount: number;
  affectedPrincipalCount: number;
}

/** Statutory notice window is treated as a point deadline; the calendar block is nominal. */
const NOTICE_DEADLINE_DURATION_MINUTES = 30;

/**
 * Reacts to a high/critical-severity breach being reported (mcp-server's
 * report_breach_event tool enqueues onto BREACH_NOTICE_DRAFT_QUEUE after
 * writing the BreachEvent — see queues.ts). Drafts a DPB notification email
 * covering the incident description, detection time, and affected
 * purposes/principals, and stages a calendar deadline for the statutory
 * notice window (breachEvent.dpbNotifyDueAt). Never sends/creates anything
 * itself — same draft-then-confirm pattern as Phase 3's expiry sweep /
 * withdrawal cascade. Pure function over ConsentRepository/LedgerRepository
 * (plus an injected staging callback), so it's unit-testable against
 * mock-store without Redis/Postgres.
 */
export async function runBreachNoticeDraft(
  consent: ConsentRepository,
  ledger: LedgerRepository,
  data: BreachNoticeDraftJobData,
  stagePendingAction: StagePendingAction,
): Promise<BreachNoticeDraftResult> {
  const breach = await ledger.findBreachEventById(data.breachEventId);
  if (!breach) throw new Error(`Unknown breach event: ${data.breachEventId}`);
  if (breach.severity !== "high" && breach.severity !== "critical") {
    throw new Error(`Breach ${breach.id} has severity "${breach.severity}" — only high/critical trigger auto-drafting.`);
  }

  const dpbEmail = process.env.DPB_NOTIFICATION_EMAIL;
  if (!dpbEmail) {
    throw new Error(
      "DPB_NOTIFICATION_EMAIL must be set to draft a breach notice — no real Data Protection Board contact " +
        "is configured by default, since accidentally defaulting to a real regulator's address would be a genuine problem.",
    );
  }

  const purposes = await Promise.all(breach.affectedPurposeIds.map((id) => consent.findPurposeById(id)));
  const purposeLabels = purposes.map((purpose, i) => purpose?.description ?? breach.affectedPurposeIds[i]!);

  let affectedPrincipalCount = 0;
  for (const purposeId of breach.affectedPurposeIds) {
    const granted = await consent.listConsentArtifacts({ purposeId, status: "granted" });
    affectedPrincipalCount += granted.length;
  }

  const emailAction: PendingEmailAction = {
    kind: "breach_notice_email",
    refId: breach.id,
    recipientEmail: dpbEmail,
    recipientName: "Data Protection Board",
    subject: `Personal Data Breach Notification — ${breach.description.slice(0, 60)}`,
    body:
      `To the Data Protection Board,\n\n` +
      `This notice is submitted under the Digital Personal Data Protection Act, 2023 regarding a personal ` +
      `data breach.\n\n` +
      `Incident description: ${breach.description}\n` +
      `Detected at: ${breach.detectedAt.toISOString()}\n` +
      `Severity: ${breach.severity}\n` +
      `Affected purposes: ${purposeLabels.length > 0 ? purposeLabels.join(", ") : "none recorded"}\n` +
      `Affected data principals (approx.): ${affectedPrincipalCount}\n` +
      `Statutory notification deadline: ${breach.dpbNotifyDueAt.toDateString()}\n\n` +
      `Breach reference: ${breach.id}\n\n` +
      `— LexEdu Technologies Data Protection Office`,
  };
  await stagePendingAction(emailAction);

  const deadlineEnd = new Date(breach.dpbNotifyDueAt.getTime() + NOTICE_DEADLINE_DURATION_MINUTES * 60 * 1000);
  const calendarAction: PendingCalendarAction = {
    kind: "breach_notice_deadline",
    refId: breach.id,
    recipientEmail: dpbEmail,
    recipientName: "Data Protection Board",
    summary: `DPB breach notification deadline — ${breach.description.slice(0, 60)}`,
    description: `Statutory DPB notification deadline for breach "${breach.description}" (severity: ${breach.severity}, ref: ${breach.id}).`,
    startTime: breach.dpbNotifyDueAt.toISOString(),
    endTime: deadlineEnd.toISOString(),
  };
  await stagePendingAction(calendarAction);

  logStaged(`breach notice + DPB deadline for ${breach.id} (${breach.severity}) — awaiting confirmation`);

  return {
    breachEventId: breach.id,
    affectedPurposeCount: breach.affectedPurposeIds.length,
    affectedPrincipalCount,
  };
}
