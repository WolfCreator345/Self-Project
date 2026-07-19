import { PrismaLedgerRepository } from "../src/consent-vault/prisma-ledger.repository";
import { PrismaService } from "../src/prisma/prisma.service";
import { resetDatabase } from "./test-db";

describe("PrismaLedgerRepository", () => {
  const prisma = new PrismaService();
  const ledger = new PrismaLedgerRepository(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("computes a compliance snapshot across consents, DSRs, and breaches", async () => {
    const snapshot = await ledger.getComplianceSnapshot({
      from: new Date("2026-01-01"),
      to: new Date("2026-12-31"),
    });
    expect(snapshot.consentsGranted).toBeGreaterThan(0);
    expect(snapshot.dsrOverdue).toBeGreaterThanOrEqual(1);
    expect(snapshot.breachesLogged).toBe(1);
  });

  it("seeds ledger entries in increasing sequence order", async () => {
    const entries = await ledger.listEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]!.sequence).toBeGreaterThan(entries[i - 1]!.sequence);
    }
  });

  it("creates a breach event and logs a ledger entry for it", async () => {
    const before = await ledger.listEntries();
    const event = await ledger.createBreachEvent({
      description: "Test breach",
      detectedAt: new Date(),
      dpbNotifyDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      severity: "medium",
    });
    expect(event.id).toBeTruthy();

    const after = await ledger.listEntries();
    expect(after.length).toBe(before.length + 1);
    expect(await ledger.listBreachEvents()).toHaveLength(2);
  });
});
