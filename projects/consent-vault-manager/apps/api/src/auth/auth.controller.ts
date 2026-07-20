import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<{ username: string }> {
    const valid = await this.authService.validateCredentials(dto.username, dto.password);
    if (!valid) throw new UnauthorizedException("Invalid username or password");

    req.session.authenticated = true;
    req.session.username = dto.username;
    return { username: dto.username };
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
  me(@Req() req: Request): { username: string } {
    return { username: req.session.username! };
  }
}
