import { Module } from "@nestjs/common";

import { ComplianceController } from "./compliance.controller";
import { ConsentArtifactsController } from "./consent-artifacts.controller";
import { DSRRequestsController } from "./dsr-requests.controller";
import { PendingBreachNoticesService } from "./pending-breach-notices.service";
import { PrincipalsController } from "./principals.controller";
import { PrismaConsentRepository } from "./prisma-consent.repository";
import { PrismaDSRRepository } from "./prisma-dsr.repository";
import { PrismaLedgerRepository } from "./prisma-ledger.repository";
import { PrismaUserRepository } from "./prisma-user.repository";
import { PurposesController } from "./purposes.controller";
import { UsersController } from "./users.controller";

@Module({
  controllers: [
    PrincipalsController,
    PurposesController,
    ConsentArtifactsController,
    DSRRequestsController,
    ComplianceController,
    UsersController,
  ],
  providers: [
    PrismaConsentRepository,
    PrismaDSRRepository,
    PrismaLedgerRepository,
    PrismaUserRepository,
    PendingBreachNoticesService,
  ],
  exports: [PrismaConsentRepository, PrismaDSRRepository, PrismaLedgerRepository, PrismaUserRepository],
})
export class ConsentVaultModule {}
