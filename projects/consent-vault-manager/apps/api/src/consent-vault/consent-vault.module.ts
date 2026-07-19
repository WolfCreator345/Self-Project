import { Module } from "@nestjs/common";

import { ConsentArtifactsController } from "./consent-artifacts.controller";
import { PrincipalsController } from "./principals.controller";
import { PrismaConsentRepository } from "./prisma-consent.repository";
import { PrismaDSRRepository } from "./prisma-dsr.repository";
import { PrismaLedgerRepository } from "./prisma-ledger.repository";
import { PurposesController } from "./purposes.controller";

@Module({
  controllers: [PrincipalsController, PurposesController, ConsentArtifactsController],
  providers: [PrismaConsentRepository, PrismaDSRRepository, PrismaLedgerRepository],
  exports: [PrismaConsentRepository, PrismaDSRRepository, PrismaLedgerRepository],
})
export class ConsentVaultModule {}
