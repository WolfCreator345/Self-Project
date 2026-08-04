import "express-session";

import type { Role } from "../../../../mock-store/types";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    username?: string;
    /** Phase 8: which fiduciary (tenant) this session's user belongs to — every scoped query filters by this. */
    fiduciaryId?: string;
    role?: Role;
  }
}
