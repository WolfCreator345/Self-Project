import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";

/**
 * Single admin user, seeded via env vars (ADMIN_USERNAME/ADMIN_PASSWORD_HASH)
 * rather than stored in the database — there's no multi-user/role model yet
 * (Phase 6 spec explicitly defers that to future work), so a DB-backed User
 * table would be pure overhead right now.
 */
@Injectable()
export class AuthService {
  async validateCredentials(username: string, password: string): Promise<boolean> {
    const expectedUsername = process.env.ADMIN_USERNAME;
    const expectedPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!expectedUsername || !expectedPasswordHash) {
      throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD_HASH must be set in the environment");
    }
    if (username !== expectedUsername) return false;
    return bcrypt.compare(password, expectedPasswordHash);
  }
}
