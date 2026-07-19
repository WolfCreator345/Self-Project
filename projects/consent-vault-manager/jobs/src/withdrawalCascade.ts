import type { InMemoryConsentVaultStore } from "../../mock-store/index.js";
import { logWouldNotify } from "./notify.js";

export interface WithdrawalCascadeJobData {
  consentId: string;
}

export interface WithdrawalCascadeResult {
  consentId: string;
  flaggedProcessorIds: string[];
}

/**
 * Reacts to a "consent revoked" event: looks up the withdrawn artifact's
 * purpose, finds every active downstream Processor tied to that purpose,
 * marks each for purge (store.markProcessorForPurge — which writes the
 * ConsentLedgerEntry) and logs a would-be purge/notify message. Pure
 * function over the store, driven by the withdrawal-cascade queue's worker
 * in index.ts, and fireable manually via scripts/fire-withdrawal-event.ts.
 */
export async function runWithdrawalCascade(
  store: InMemoryConsentVaultStore,
  data: WithdrawalCascadeJobData,
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

  const flaggedProcessorIds: string[] = [];
  for (const processor of processors) {
    await store.markProcessorForPurge(
      processor.id,
      `Downstream of withdrawn consent ${artifact.id} (${principalLabel}, purpose "${purposeLabel}")`,
    );
    flaggedProcessorIds.push(processor.id);

    logWouldNotify(
      `${processor.name}: purge data for ${principalLabel} under purpose "${purposeLabel}" ` +
        `(consent ${artifact.id} withdrawn)`,
    );
  }

  return { consentId: artifact.id, flaggedProcessorIds };
}
