import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { ConsentVaultModule } from "../consent-vault/consent-vault.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RolesGuard } from "./roles.guard";
import { SessionAuthGuard } from "./session-auth.guard";

@Module({
  imports: [ConsentVaultModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Order matters: SessionAuthGuard runs first (establishes "logged in",
    // throws 401 otherwise), then RolesGuard (assumes a session exists,
    // throws 403 if the role doesn't match a route's @Roles()). NestJS runs
    // APP_GUARDs in registration order.
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
