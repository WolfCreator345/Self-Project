import { PrismaDSRRepository } from "../src/consent-vault/prisma-dsr.repository";
import { PrismaLedgerRepository } from "../src/consent-vault/prisma-ledger.repository";
import { PrismaService } from "../src/prisma/prisma.service";
import { resetDatabase } from "./test-db";

describe("PrismaDSRRepository", () => {
  const prisma = new PrismaService();
  const ledger = new PrismaLedgerRepository(prisma);
  const dsrRepository = new PrismaDSRRepository(prisma, ledger);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a DSR request with a 30-day due date", async () => {
    const request = await dsrRepository.createDSRRequest({ principalId: "principal-1", type: "access" });
    const diffDays = Math.round((request.dueAt.getTime() - request.submittedAt.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
    expect(request.status).toBe("open");
  });

  it("lists exactly one overdue DSR request", async () => {
    const overdue = await dsrRepository.listDSRRequests({ overdueOnly: true });
    expect(overdue).toHaveLength(1);
    expect(overdue[0]!.id).toBe("dsr-2");
  });

  it("resolving a DSR request writes a ledger entry and sets resolvedAt", async () => {
    const before = await ledger.listEntries();
    const resolved = await dsrRepository.updateDSRStatus("dsr-1", "resolved");
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).toBeTruthy();

    const after = await ledger.listEntries();
    expect(after.length).toBe(before.length + 1);
  });
});
