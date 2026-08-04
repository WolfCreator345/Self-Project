import { PrismaUserRepository } from "../src/consent-vault/prisma-user.repository";
import { PrismaService } from "../src/prisma/prisma.service";
import { resetDatabase } from "./test-db";

describe("PrismaUserRepository (Phase 8)", () => {
  const prisma = new PrismaService();
  const userRepository = new PrismaUserRepository(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds three roles per fiduciary, listed only within that fiduciary", async () => {
    const usersA = await userRepository.listUsers("fiduciary-1");
    const usersB = await userRepository.listUsers("fiduciary-2");
    expect(usersA.map((u) => u.role).sort()).toEqual(["admin", "dpo", "viewer"]);
    expect(usersB.map((u) => u.role).sort()).toEqual(["admin", "dpo", "viewer"]);
    expect(usersA.every((u) => u.fiduciaryId === "fiduciary-1")).toBe(true);
    expect(usersB.every((u) => u.fiduciaryId === "fiduciary-2")).toBe(true);
  });

  it("finds a seeded user by username with the right role", async () => {
    const user = await userRepository.findUserByUsername("dpo@lexedu.example");
    expect(user?.role).toBe("dpo");
    expect(user?.fiduciaryId).toBe("fiduciary-1");
  });

  it("creates a user, rejects a duplicate username, and updates a user's role", async () => {
    const created = await userRepository.createUser({
      fiduciaryId: "fiduciary-2",
      username: "newhire@northbridge.example",
      passwordHash: "fake-hash",
      role: "viewer",
    });
    expect(created.role).toBe("viewer");
    expect(await userRepository.listUsers("fiduciary-2")).toHaveLength(4);

    await expect(
      userRepository.createUser({
        fiduciaryId: "fiduciary-2",
        username: "newhire@northbridge.example",
        passwordHash: "x",
        role: "dpo",
      }),
    ).rejects.toThrow(/already taken/);

    const promoted = await userRepository.updateUserRole(created.id, "dpo");
    expect(promoted.role).toBe("dpo");
    expect((await userRepository.findUserById(created.id))?.role).toBe("dpo");
  });

  it("rejects creating a user against an unknown fiduciary", async () => {
    await expect(
      userRepository.createUser({ fiduciaryId: "no-such-fiduciary", username: "ghost@example.com", passwordHash: "x", role: "admin" }),
    ).rejects.toThrow();
  });
});
