import type { InMemoryConsentVaultStore } from "../../mock-store/index.js";
import { logStaged } from "./notify.js";
import type { PendingEmailAction, StagePendingAction } from "./pendingActions.js";

export interface ExpirySweepResult {
  checkedAt: Date;
  expired: string[];
}

/**
 * Finds granted ConsentArtifacts whose expiresAt (grantedAt + Purpose's
 * retentionPeriodDays) has passed, flips each to "expired" via
 * store.markExpired — which itself writes the ConsentLedgerEntry — and
 * stages a renewal reminder email for a human to confirm and actually send.
 * Pure function over the store (plus an injected staging callback) so it
 * can be unit tested without Redis/BullMQ, and driven by a repeatable job
 * in index.ts.
 */
export async function runExpirySweep(
  store: InMemoryConsentVaultStore,
  stagePendingAction: StagePendingAction,
): Promise<ExpirySweepResult> {
  const now = new Date();
  const granted = await store.listConsentArtifacts({ status: "granted" });
  const stale = granted.filter((artifact) => artifact.expiresAt.getTime() <= now.getTime());

  const expired: string[] = [];
  for (const artifact of stale) {
    const [principal, purpose] = await Promise.all([
      store.findPrincipalById(artifact.principalId),
      store.findPurposeById(artifact.purposeId),
    ]);

    await store.markExpired(artifact.id);
    expired.push(artifact.id);

    const recipientEmail = principal?.email ?? "unknown@example.com";
    const recipientName = principal?.name ?? artifact.principalId;
    const purposeLabel = purpose?.description ?? artifact.purposeId;

    const action: PendingEmailAction = {
      kind: "renewal_email",
      refId: artifact.id,
      principalId: artifact.principalId,
      recipientEmail,
      recipientName,
      subject: `Action required: renew your consent for "${purposeLabel}"`,
      body:
        `Hi ${recipientName},\n\n` +
        `Your consent for "${purposeLabel}" expired on ${artifact.expiresAt.toDateString()} and we can no longer ` +
        `process your data for this purpose. If you'd like to continue, please renew your consent at your earliest ` +
        `convenience.\n\n` +
        `Consent reference: ${artifact.id}\n\n` +
        `— LexEdu Technologies Data Protection Office`,
    };
    await stagePendingAction(action);

    logStaged(`renewal email for ${recipientEmail} (consent ${artifact.id}) — awaiting confirmation`);
  }

  return { checkedAt: now, expired };
}
