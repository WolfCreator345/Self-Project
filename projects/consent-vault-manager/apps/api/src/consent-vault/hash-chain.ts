import { createHash } from "node:crypto";

/**
 * Deliberately duplicated from mock-store/hashChain.ts, not imported —
 * apps/api's compiled CommonJS runtime can't reach into that ESM package's
 * source the way mcp-server/jobs (run via tsx) can. Kept in sync via a
 * golden-vector test (test/hash-chain.spec.ts) asserting both
 * implementations produce byte-identical output for the same fixture
 * entries. If you change the algorithm here, change it there too, and
 * update the golden vectors in both test files.
 */

/**
 * First entry in any ledger chains from this fixed sentinel instead of a
 * real previous hash — 64 hex chars, matching SHA-256's output length.
 */
export const LEDGER_GENESIS_HASH = "0".repeat(64);

/**
 * previousHash/hash are NOT NULL columns (see schema.prisma), so "not
 * chained yet" can't be represented as null — this sentinel marks it
 * instead. Never a real hash: real hashes and LEDGER_GENESIS_HASH are
 * always exactly 64 hex characters, this is the empty string.
 */
export const PENDING_HASH_SENTINEL = "";

/**
 * Recursively sorts object keys so the same logical data always serializes
 * identically, regardless of how it round-tripped through storage — e.g.
 * Postgres's jsonb column doesn't guarantee preserving the original key
 * insertion order. Array order is left alone since it's semantically
 * significant.
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
  principalId?: string | null;
  detail: Record<string, unknown>;
  recordedAt: Date;
}

/** SHA-256 of (previousHash + this entry's own canonicalized fields). */
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
 * genesis, recomputing each hash and checking it links to the previous one.
 */
export function verifyChain(entries: HashedLedgerEntry[]): ChainVerificationResult {
  let previousHash = LEDGER_GENESIS_HASH;
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
