import type { PrismaClient, Prisma } from "@prisma/client";

// Reuses mock-store's exact deterministic seed data (single source of truth)
// rather than duplicating it — a dev-time script run via tsx, not part of
// the compiled Nest app, so the ESM/CJS boundary that keeps apps/api's own
// src/ type-only-importing from mock-store doesn't apply here. Shared by
// prisma/seed.ts (CLI) and test/test-db.ts (Jest fixture reset).
import { createSeedData } from "../../../mock-store/seed";

export async function seedDatabase(prisma: PrismaClient): Promise<ReturnType<typeof createSeedData>> {
  const seed = createSeedData();

  await prisma.dataFiduciary.create({ data: seed.fiduciary });
  for (const p of seed.principals) await prisma.dataPrincipal.create({ data: p });
  for (const p of seed.purposes) await prisma.purpose.create({ data: p });
  for (const c of seed.consentArtifacts) await prisma.consentArtifact.create({ data: c });
  for (const req of seed.dsrRequests) await prisma.dSRRequest.create({ data: req });
  for (const b of seed.breachEvents) await prisma.breachEvent.create({ data: b });
  for (const p of seed.processors) await prisma.processor.create({ data: p });

  // sequence is autoincrement in Postgres — omitted here, lines up with the
  // mock's intended order because buildLedgerEntries() already produced
  // these chronologically and we insert them in that same order.
  for (const entry of seed.ledgerEntries) {
    await prisma.consentLedgerEntry.create({
      data: {
        id: entry.id,
        entryType: entry.entryType,
        refId: entry.refId,
        principalId: entry.principalId,
        detail: entry.detail as Prisma.InputJsonValue,
        recordedAt: entry.recordedAt,
      },
    });
  }

  return seed;
}
