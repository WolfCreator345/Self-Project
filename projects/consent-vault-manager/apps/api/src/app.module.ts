import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { ConsentVaultModule } from "./consent-vault/consent-vault.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, ConsentVaultModule, AuthModule],
})
export class AppModule {}
