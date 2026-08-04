import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { Role } from "../../../../mock-store/types";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ROLES_KEY } from "./roles.decorator";

/**
 * Registered as a second app-wide guard, after SessionAuthGuard (Phase 8) —
 * NestJS runs APP_GUARDs in registration order, so SessionAuthGuard always
 * establishes "there is a logged-in session" first, and this guard can then
 * assume req.session.role is set for anything that reaches it.
 *
 * A route with no @Roles(...) decorator is unrestricted (any authenticated
 * role passes) — this is what every plain GET endpoint gets by default,
 * matching SessionAuthGuard's own "protected unless opted out" posture but
 * inverted: here, opt IN to a restriction rather than opt out of one.
 * @Public() routes (login/logout) skip this guard entirely, same as they
 * skip SessionAuthGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const role = request.session?.role;
    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `This action requires one of: ${requiredRoles.join(", ")}. Your role is ${role ?? "none"}.`,
      );
    }
    return true;
  }
}
