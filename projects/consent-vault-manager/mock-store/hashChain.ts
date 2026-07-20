import { createHash } from "node:crypto";

/**
 * First entry in any ledger chains from this fixed sentinel instead of a
 * real previous hash — 64 hex chars, matching SHA-256's output length.
 */
export const LEDGER_GENESIS_HASH = "0".repeat(64);

/**
 * Recursively sorts object keys so the same logical data always serializes
 * identically, regardless of how it round-tripped through storage — e.g.
 * Postgres's jsonb column doesn't guarantee preserving the original key
 * insertion order. Array order is left alone since it's semantically
 * significant. Without this, re-verifying a hash after a DB round trip
 * could fail on untampered data purely due to key reordering.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(",")}}`;
}

export interface HashableLedgerEntry {
  id: string;
  sequence: number;
  entryType: string;
  refId: string;
  principalId?: string;
  detail: Record<string, unknown>;
  recordedAt: Date;
}

/**
 * SHA-256 of (previousHash + this entry's own canonicalized fields).
 * Duplicated (deliberately, not imported) in apps/api/src/consent-vault/
 * hash-chain.ts, since apps/api's compiled CommonJS runtime can't reach
 * into this ESM package's source the way mcp-server/jobs (run via tsx) can.
 * Kept in sync via a golden-vector test in both packages — see
 * apps/api/test/hash-chain.spec.ts.
 */
export function computeLedgerEntryHash(previousHash: string, entry: HashableLedgerEntry): string {
  const payload = canonicalStringify({
    id: entry.id,
    sequence: entry.sequence,
    entryType: entry.entryType,
    refId: entry.refId,
    principalId: entry.principalId ?? null,
    detail: entry.detail,
    recordedAt: entry.recordedAt.toISOString(),
  });
  return createHash("sha256").update(previousHash).update(payload).digest("hex");
}

export type LedgerIntegrityBreakReason = "previous_hash_mismatch" | "hash_mismatch";

export interface LedgerIntegrityBreak {
  sequence: number;
  entryId: string;
  reason: LedgerIntegrityBreakReason;
  expected: string;
  actual: string;
}

export interface ChainVerificationResult {
  intact: boolean;
  firstBreak?: LedgerIntegrityBreak;
}

export interface HashedLedgerEntry extends HashableLedgerEntry {
  previousHash: string;
  hash: string;
}

/**
 * Walks entries (must already be sorted by `sequence` ascending) from
 * `startingHash` (genesis by default), recomputing each hash and checking
 * it links to the previous one. Stops at the first break, if any — the
 * whole point of a hash chain is that everything after a tampered/corrupted
 * row is unverifiable anyway, so there's nothing more useful to report past
 * that point.
 *
 * Passing a non-genesis `startingHash` is what makes incremental
 * verification possible: given entries past a trusted checkpoint and that
 * checkpoint's own hash, this checks they link to it exactly the same way
 * it'd check any other entry links to its predecessor.
 */
export function verifyChain(
  entries: HashedLedgerEntry[],
  startingHash: string = LEDGER_GENESIS_HASH,
): ChainVerificationResult {
  let previousHash = startingHash;
  for (const entry of entries) {
    if (entry.previousHash !== previousHash) {
      return {
        intact: false,
        firstBreak: {
          sequence: entry.sequence,
          entryId: entry.id,
          reason: "previous_hash_mismatch",
          expected: previousHash,
          actual: entry.previousHash,
        },
      };
    }
    const recomputed = computeLedgerEntryHash(previousHash, entry);
    if (recomputed !== entry.hash) {
      return {
        intact: false,
        firstBreak: {
          sequence: entry.sequence,
          entryId: entry.id,
          reason: "hash_mismatch",
          expected: recomputed,
          actual: entry.hash,
        },
      };
    }
    previousHash = entry.hash;
  }
  return { intact: true };
}
