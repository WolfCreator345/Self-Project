import { PrismaClient } from "@prisma/client";

import { seedDatabase } from "../prisma/seed-database";

/**
 * Wipes every table (children before parents, respecting FKs) and reseeds
 * with mock-store's exact deterministic fixtures — the same starting point
 * mock-store's own test suite uses, so the two test suites are asserting
 * against identical data.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<ReturnType<typeof seedDatabase>> {
  await prisma.consentLedgerEntry.deleteMany();
  await prisma.dSRRequest.deleteMany();
  await prisma.consentArtifact.deleteMany();
  await prisma.processor.deleteMany();
  await prisma.breachEvent.deleteMany();
  await prisma.purpose.deleteMany();
  await prisma.dataPrincipal.deleteMany();
  await prisma.user.deleteMany();
  await prisma.dataFiduciary.deleteMany();

  return seedDatabase(prisma);
}

export { PrismaClient };
