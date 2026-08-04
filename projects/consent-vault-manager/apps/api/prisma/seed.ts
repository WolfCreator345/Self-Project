import { PrismaClient } from "@prisma/client";

import { seedDatabase } from "./seed-database";

const prisma = new PrismaClient();

async function main() {
  const seed = await seedDatabase(prisma);
  console.log(
    `Seeded ${seed.fiduciaries.length} fiduciaries, ${seed.principals.length} principals, ${seed.purposes.length} purposes, ` +
      `${seed.consentArtifacts.length} consent artifacts, ${seed.dsrRequests.length} DSR requests, ` +
      `${seed.breachEvents.length} breach events, ${seed.processors.length} processors, ${seed.users.length} users, ` +
      `${seed.ledgerEntries.length} ledger entries.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
