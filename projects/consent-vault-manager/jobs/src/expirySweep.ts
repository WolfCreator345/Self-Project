import type { InMemoryConsentVaultStore } from "../../mock-store/index.js";
import { logWouldEmail } from "./notify.js";

export interface ExpirySweepResult {
  checkedAt: Date;
  expired: string[];
}

/**
 * Finds granted ConsentArtifacts whose expiresAt (grantedAt + Purpose's
 * retentionPeriodDays) has passed, flips each to "expired" via
 * store.markExpired — which itself writes the ConsentLedgerEntry — and logs
 * a would-be renewal email. Pure function over the store so it can be unit
 * tested without Redis/BullMQ and driven by a repeatable job in index.ts.
 */
export async function runExpirySweep(store: InMemoryConsentVaultStore): Promise<ExpirySweepResult> {
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

    logWouldEmail(
      `${principal?.name ?? artifact.principalId} <${principal?.email ?? "unknown"}>: consent for purpose ` +
        `"${purpose?.description ?? artifact.purposeId}" expired on ${artifact.expiresAt.toISOString()} — renewal requested`,
    );
  }

  return { checkedAt: now, expired };
}
