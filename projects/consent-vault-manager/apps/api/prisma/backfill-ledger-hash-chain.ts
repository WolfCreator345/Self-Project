import { PrismaClient } from "@prisma/client";

import { backfillLedgerHashChain } from "../src/consent-vault/backfill-hash-chain";

const prisma = new PrismaClient();

async function main() {
  const result = await backfillLedgerHashChain(prisma);
  if (result.backfilled === 0) {
    console.log("Nothing to backfill — every ledger entry already has a hash.");
  } else {
    console.log(
      `Backfilled ${result.backfilled} ledger entr${result.backfilled === 1 ? "y" : "ies"} ` +
        `starting at sequence ${result.resumedFromSequence}.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
