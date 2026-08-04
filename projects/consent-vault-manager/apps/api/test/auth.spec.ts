import { AuthService } from "../src/auth/auth.service";
import { PrismaUserRepository } from "../src/consent-vault/prisma-user.repository";
import { PrismaService } from "../src/prisma/prisma.service";
import { resetDatabase } from "./test-db";

/**
 * Phase 8: real bcrypt-backed login, replacing the old env-var single
 * admin. All seeded demo users share one password ("demo-password-123" —
 * see mock-store/seed.ts's DEMO_PASSWORD_HASH comment).
 */
describe("AuthService (Phase 8)", () => {
  const prisma = new PrismaService();
  const userRepository = new PrismaUserRepository(prisma);
  const authService = new AuthService(userRepository);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("authenticates a seeded user with the correct password", async () => {
    const user = await authService.validateCredentials("admin@lexedu.example", "demo-password-123");
    expect(user?.username).toBe("admin@lexedu.example");
    expect(user?.role).toBe("admin");
    expect(user?.fiduciaryId).toBe("fiduciary-1");
  });

  it("rejects the wrong password", async () => {
    expect(await authService.validateCredentials("admin@lexedu.example", "not-the-password")).toBeNull();
  });

  it("rejects an unknown username", async () => {
    expect(await authService.validateCredentials("nobody@example.com", "demo-password-123")).toBeNull();
  });

  it("distinguishes users in different fiduciaries with the same-shaped credentials", async () => {
    const lexeduAdmin = await authService.validateCredentials("admin@lexedu.example", "demo-password-123");
    const northbridgeAdmin = await authService.validateCredentials("admin@northbridge.example", "demo-password-123");
    expect(lexeduAdmin?.fiduciaryId).toBe("fiduciary-1");
    expect(northbridgeAdmin?.fiduciaryId).toBe("fiduciary-2");
    expect(lexeduAdmin?.id).not.toBe(northbridgeAdmin?.id);
  });
});
