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

  it("filters DSR requests by type", async () => {
    await dsrRepository.createDSRRequest({ principalId: "principal-1", type: "erasure" });
    await dsrRepository.createDSRRequest({ principalId: "principal-2", type: "correction" });

    const erasureRequests = await dsrRepository.listDSRRequests({ type: "erasure" });
    expect(erasureRequests.length).toBeGreaterThan(0);
    expect(erasureRequests.every((r) => r.type === "erasure")).toBe(true);

    const correctionRequests = await dsrRepository.listDSRRequests({ type: "correction" });
    expect(correctionRequests.length).toBeGreaterThan(0);
    expect(correctionRequests.every((r) => r.type === "correction")).toBe(true);
  });

  it("resolving a DSR request writes a ledger entry and sets resolvedAt", async () => {
    const before = await ledger.listEntries();
    const resolved = await dsrRepository.updateDSRStatus("dsr-1", "resolved");
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).toBeTruthy();

    const after = await ledger.listEntries();
    expect(after.length).toBe(before.length + 1);
  });

  describe("Multi-tenant (Phase 8)", () => {
    it("derives a new DSR request's fiduciaryId from its principal", async () => {
      const request = await dsrRepository.createDSRRequest({ principalId: "principal-10", type: "erasure" });
      expect(request.fiduciaryId).toBe("fiduciary-2");
    });

    it("scopes listDSRRequests by fiduciary", async () => {
      const requestsB = await dsrRepository.listDSRRequests({ fiduciaryId: "fiduciary-2" });
      expect(requestsB.map((r) => r.id)).toEqual(["dsr-4"]);
    });
  });
});
