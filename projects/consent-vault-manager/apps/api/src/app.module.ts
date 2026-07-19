import { Module } from "@nestjs/common";

import { ConsentVaultModule } from "./consent-vault/consent-vault.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, ConsentVaultModule],
})
export class AppModule {}
