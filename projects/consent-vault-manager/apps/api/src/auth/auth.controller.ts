import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import type { Role } from "../../../../mock-store/types";
import { PrismaConsentRepository } from "../consent-vault/prisma-consent.repository";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./public.decorator";

interface MeResponse {
  username: string;
  role: Role;
  fiduciaryId: string;
  fiduciaryName: string;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly consentRepository: PrismaConsentRepository,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<MeResponse> {
    const user = await this.authService.validateCredentials(dto.username, dto.password);
    if (!user) throw new UnauthorizedException("Invalid username or password");

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.fiduciaryId = user.fiduciaryId;
    req.session.role = user.role;

    const fiduciary = await this.consentRepository.findFiduciaryById(user.fiduciaryId);
    return { username: user.username, role: user.role, fiduciaryId: user.fiduciaryId, fiduciaryName: fiduciary?.name ?? user.fiduciaryId };
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request): Promise<{ ok: true }> {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
    return { ok: true };
  }

  /**
   * Protected by the global SessionAuthGuard (not @Public()) — this is
   * exactly what makes it useful as a "am I still logged in?" check: an
   * unauthenticated request never reaches this handler at all, the guard
   * throws 401 first, which is what the dashboard's route guard/session
   * context treats as "redirect to login".
   */
  @Get("me")
  async me(@Req() req: Request): Promise<MeResponse> {
    const fiduciary = await this.consentRepository.findFiduciaryById(req.session.fiduciaryId!);
    return {
      username: req.session.username!,
      role: req.session.role!,
      fiduciaryId: req.session.fiduciaryId!,
      fiduciaryName: fiduciary?.name ?? req.session.fiduciaryId!,
    };
  }
}
