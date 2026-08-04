import { SetMetadata } from "@nestjs/common";

import type { Role } from "../../../../mock-store/types";

export const ROLES_KEY = "roles";

/**
 * Phase 8: restricts a route to specific roles. A route with no @Roles() at
 * all is reachable by any authenticated role (the common case — every read
 * endpoint) — RolesGuard only enforces something when this metadata is
 * present. @Public() routes never reach RolesGuard's check at all (see its
 * doc comment).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
