import { LEDGER_GENESIS_HASH } from "../src/consent-vault/hash-chain";
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

  it("seeds (post-backfill) a valid hash chain, reported intact end to end", async () => {
    const entries = await ledger.listEntries();
    const report = await ledger.verifyLedgerIntegrity();
    expect(report.intact).toBe(true);
    expect(report.entriesChecked).toBe(entries.length);
    expect(report.firstBreak).toBeUndefined();

    // Not necessarily sequence 1 — Postgres's autoincrement counter doesn't
    // reset just because resetDatabase() deleted every row (only TRUNCATE
    // ... RESTART IDENTITY would), so whichever entry has the lowest
    // sequence in *this* run is the true first link, whatever number that is.
    const first = entries.reduce((min, e) => (e.sequence < min.sequence ? e : min));
    expect(first.previousHash).toBe(LEDGER_GENESIS_HASH);
  });

  it("stays intact after a new entry is appended at runtime", async () => {
    await ledger.createBreachEvent({
      description: "Another test breach",
      detectedAt: new Date(),
      dpbNotifyDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      severity: "low",
    });

    const report = await ledger.verifyLedgerIntegrity();
    expect(report.intact).toBe(true);
  });

  it("entriesChecked respects a date range while still verifying the full chain", async () => {
    const allEntries = await ledger.listEntries();
    const report = await ledger.verifyLedgerIntegrity({ from: new Date("2026-01-01"), to: new Date("2026-12-31") });
    expect(report.intact).toBe(true);
    expect(report.entriesChecked).toBeGreaterThan(0);
    expect(report.entriesChecked).toBeLessThanOrEqual(allEntries.length);
  });

  it("a second call with no new entries only re-checks the delta (nothing)", async () => {
    await ledger.verifyLedgerIntegrity(); // sets the checkpoint; DB is fresh from beforeEach

    const report = await ledger.verifyLedgerIntegrity();
    expect(report.intact).toBe(true);
    expect(report.verifiedFullChain).toBe(false);
    expect(report.entriesChecked).toBe(0);
  });

  it("after appending a new entry, only the delta past the checkpoint is checked", async () => {
    await ledger.verifyLedgerIntegrity(); // sets the checkpoint

    await ledger.createBreachEvent({
      description: "Post-checkpoint breach",
      detectedAt: new Date(),
      dpbNotifyDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      severity: "low",
    });

    const report = await ledger.verifyLedgerIntegrity();
    expect(report.intact).toBe(true);
    expect(report.verifiedFullChain).toBe(false);
    expect(report.entriesChecked).toBe(1);
  });

  it("verifyFullChain: true forces a full walk from genesis even with a valid checkpoint", async () => {
    const entries = await ledger.listEntries();
    await ledger.verifyLedgerIntegrity(); // sets the checkpoint

    const report = await ledger.verifyLedgerIntegrity(undefined, true);
    expect(report.intact).toBe(true);
    expect(report.verifiedFullChain).toBe(true);
    expect(report.entriesChecked).toBe(entries.length);
  });

  it("self-heals to a full walk if the cached checkpoint no longer matches live data", async () => {
    await ledger.verifyLedgerIntegrity(); // sets a checkpoint against the current (pre-reset) rows

    // Simulate the data being reseeded out-of-band since the last check —
    // resetDatabase deletes and re-inserts every row, so Postgres's
    // never-reused autoincrement `sequence` means the old checkpoint can no
    // longer match any live row.
    await resetDatabase(prisma);
    const entries = await ledger.listEntries();

    const report = await ledger.verifyLedgerIntegrity();
    expect(report.intact).toBe(true);
    expect(report.verifiedFullChain).toBe(true);
    expect(report.entriesChecked).toBe(entries.length);
  });
});
