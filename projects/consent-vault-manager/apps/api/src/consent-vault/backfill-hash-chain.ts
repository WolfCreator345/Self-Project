import type { PrismaClient } from "@prisma/client";

import { computeLedgerEntryHash, LEDGER_GENESIS_HASH, PENDING_HASH_SENTINEL } from "./hash-chain";

export interface BackfillResult {
  backfilled: number;
  resumedFromSequence?: number;
}

/**
 * Computes previousHash/hash, in true write order (`sequence`, not
 * `recordedAt`), for every ConsentLedgerEntry row still holding the
 * PENDING_HASH_SENTINEL placeholder. Idempotent and resumable: rows that
 * already have a real hash are left untouched, and the chain resumes from
 * the last real hash rather than assuming an empty table.
 *
 * Used by both the one-time CLI backfill script (prisma/backfill-ledger-hash-chain.ts)
 * and seed-database.ts. The seed script deliberately does NOT reuse the
 * previousHash/hash values already computed on mock-store's seed data —
 * those assume `sequence` starts at 1, which is only true the very first
 * time this database is ever seeded. Postgres's autoincrement counter
 * doesn't reset just because the tables were truncated (a re-seeded dev
 * database, or this repo's own test suite resetting fixtures between
 * tests, both advance it), so the seed always computes hashes against
 * whatever `sequence` Postgres actually assigned, via this same function.
 */
export async function backfillLedgerHashChain(prisma: PrismaClient): Promise<BackfillResult> {
  const allEntries = await prisma.consentLedgerEntry.findMany({ orderBy: { sequence: "asc" } });

  let previousHash = LEDGER_GENESIS_HASH;
  let resumeIndex = 0;
  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i]!;
    if (entry.hash !== PENDING_HASH_SENTINEL && entry.previousHash !== PENDING_HASH_SENTINEL) {
      previousHash = entry.hash;
      resumeIndex = i + 1;
    } else {
      break; // first pending entry in sequence order — backfill from here onward
    }
  }

  const toBackfill = allEntries.slice(resumeIndex);
  for (const entry of toBackfill) {
    const hash = computeLedgerEntryHash(previousHash, {
      id: entry.id,
      sequence: entry.sequence,
      entryType: entry.entryType,
      refId: entry.refId,
      principalId: entry.principalId,
      detail: entry.detail as Record<string, unknown>,
      recordedAt: entry.recordedAt,
    });
    await prisma.consentLedgerEntry.update({ where: { id: entry.id }, data: { previousHash, hash } });
    previousHash = hash;
  }

  return { backfilled: toBackfill.length, resumedFromSequence: toBackfill[0]?.sequence };
}
