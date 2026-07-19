import { addDays, type ConsentRepository } from "../../mock-store/index.js";
import { logStaged } from "./notify.js";
import type { PendingCalendarAction, PendingEmailAction, StagePendingAction } from "./pendingActions.js";

export interface WithdrawalCascadeJobData {
  consentId: string;
}

export interface WithdrawalCascadeResult {
  consentId: string;
  flaggedProcessorIds: string[];
}

const PURGE_FOLLOWUP_DAYS = 7;
const PURGE_FOLLOWUP_DURATION_MINUTES = 30;

/**
 * Reacts to a "consent revoked" event: looks up the withdrawn artifact's
 * purpose, finds every active downstream Processor tied to that purpose,
 * marks each for purge (store.markProcessorForPurge — which writes the
 * ConsentLedgerEntry), and stages both a purge-notice email and a 7-day
 * follow-up calendar event for a human to confirm and actually create.
 * Pure function over a ConsentRepository (plus an injected staging
 * callback) — mock-store's InMemoryConsentVaultStore satisfies this for
 * unit tests, PrismaConsentRepository satisfies it for the real
 * withdrawal-cascade queue worker in index.ts. Fireable manually via
 * scripts/fire-withdrawal-event.ts.
 */
export async function runWithdrawalCascade(
  store: ConsentRepository,
  data: WithdrawalCascadeJobData,
  stagePendingAction: StagePendingAction,
): Promise<WithdrawalCascadeResult> {
  const artifact = await store.findConsentArtifactById(data.consentId);
  if (!artifact) throw new Error(`Unknown consent artifact: ${data.consentId}`);

  const [principal, purpose, processors] = await Promise.all([
    store.findPrincipalById(artifact.principalId),
    store.findPurposeById(artifact.purposeId),
    store.listProcessors({ purposeId: artifact.purposeId, status: "active" }),
  ]);

  const principalLabel = principal?.name ?? artifact.principalId;
  const purposeLabel = purpose?.description ?? artifact.purposeId;
  const withdrawnLabel = artifact.withdrawnAt?.toDateString() ?? "recently";

  const flaggedProcessorIds: string[] = [];
  for (const processor of processors) {
    await store.markProcessorForPurge(
      processor.id,
      `Downstream of withdrawn consent ${artifact.id} (${principalLabel}, purpose "${purposeLabel}")`,
    );
    flaggedProcessorIds.push(processor.id);

    const followUpStart = addDays(new Date(), PURGE_FOLLOWUP_DAYS);
    const followUpEnd = new Date(followUpStart.getTime() + PURGE_FOLLOWUP_DURATION_MINUTES * 60 * 1000);

    const emailAction: PendingEmailAction = {
      kind: "purge_notice_email",
      refId: processor.id,
      principalId: artifact.principalId,
      recipientEmail: processor.contactEmail,
      recipientName: processor.name,
      subject: `Data purge required — consent withdrawn (${purposeLabel})`,
      body:
        `Hello ${processor.name} team,\n\n` +
        `${principalLabel}'s consent for "${purposeLabel}" was withdrawn on ${withdrawnLabel}. Please purge all data ` +
        `you hold for this individual under this purpose and confirm completion by ${followUpStart.toDateString()}.\n\n` +
        `Consent reference: ${artifact.id}\n\n` +
        `— LexEdu Technologies Data Protection Office`,
    };
    await stagePendingAction(emailAction);

    const eventAction: PendingCalendarAction = {
      kind: "purge_followup_event",
      refId: processor.id,
      principalId: artifact.principalId,
      recipientEmail: processor.contactEmail,
      recipientName: processor.name,
      summary: `Confirm data purge: ${processor.name} (${purposeLabel})`,
      description:
        `Follow up with ${processor.name} <${processor.contactEmail}> to confirm they purged ${principalLabel}'s ` +
        `data under purpose "${purposeLabel}" after consent ${artifact.id} was withdrawn on ${withdrawnLabel}.`,
      startTime: followUpStart.toISOString(),
      endTime: followUpEnd.toISOString(),
    };
    await stagePendingAction(eventAction);

    logStaged(`purge notice + ${PURGE_FOLLOWUP_DAYS}-day follow-up for ${processor.name} <${processor.contactEmail}> — awaiting confirmation`);
  }

  return { consentId: artifact.id, flaggedProcessorIds };
}
