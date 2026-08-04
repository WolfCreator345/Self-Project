import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";

import type { User } from "../../../../mock-store/types";
import { PrismaUserRepository } from "../consent-vault/prisma-user.repository";

/**
 * Phase 8: real, DB-backed multi-user auth — replaces the old single admin
 * user seeded via env vars (ADMIN_USERNAME/ADMIN_PASSWORD_HASH). Every user
 * belongs to exactly one DataFiduciary (tenant) and has a role (admin/dpo/
 * viewer); see mock-store/types.ts's Role doc comment for the permission
 * split.
 */
@Injectable()
export class AuthService {
  constructor(private readonly users: PrismaUserRepository) {}

  /** Returns the authenticated User on success, or null on a bad username/password — never throws for that case. */
  async validateCredentials(username: string, password: string): Promise<User | null> {
    const user = await this.users.findUserByUsername(username);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }
}
