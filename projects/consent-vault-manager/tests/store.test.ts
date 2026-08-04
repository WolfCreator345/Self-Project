import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeLedgerEntryHash,
  createSeededStore,
  LEDGER_GENESIS_HASH,
  verifyChain,
  type HashedLedgerEntry,
} from "../mock-store/index.js";

describe("seed data", () => {
  it("seeds the expected entity counts", async () => {
    const store = createSeededStore();
    assert.equal((await store.listPrincipals()).length, 8);
    assert.equal((await store.listPurposes()).length, 4);
    assert.equal((await store.listConsentArtifacts()).length, 12);
    assert.equal((await store.listDSRRequests()).length, 3);
    assert.equal((await store.listBreachEvents()).length, 1);
    assert.equal((await store.listProcessors()).length, 6);
  });

  it("seeds a mix of consent statuses", async () => {
    const store = createSeededStore();
    const consents = await store.listConsentArtifacts();
    const statuses = new Set(consents.map((c) => c.status));
    assert.deepEqual([...statuses].sort(), ["expired", "granted", "withdrawn"]);
  });

  it("seeds exactly one overdue DSR request", async () => {
    const store = createSeededStore();
    const overdue = await store.listDSRRequests({ overdueOnly: true });
    assert.equal(overdue.length, 1);
    assert.equal(overdue[0]?.id, "dsr-2");
  });

  it("seeds ledger entries covering every historical state change, in order", async () => {
    const store = createSeededStore();
    const entries = await store.listEntries();
    assert.ok(entries.length > 0);
    for (let i = 1; i < entries.length; i++) {
      assert.ok(entries[i]!.sequence > entries[i - 1]!.sequence);
      assert.ok(entries[i]!.recordedAt.getTime() >= entries[i - 1]!.recordedAt.getTime());
    }
  });
});

describe("ConsentRepository", () => {
  it("creates a new principal and a new purpose", async () => {
    const store = createSeededStore();

    const principal = await store.createPrincipal({
      name: "Neha Kapoor",
      email: "neha.kapoor@example.com",
      isMinor: false,
    });
    assert.ok(principal.id);
    assert.equal(await store.findPrincipalById(principal.id).then((p) => p?.email), "neha.kapoor@example.com");
    assert.equal((await store.listPrincipals()).length, 9);

    const purpose = await store.createPurpose({
      description: "Newsletter subscription",
      lawfulBasis: "consent",
      retentionPeriodDays: 400,
    });
    assert.ok(purpose.id);
    assert.equal((await store.listPurposes()).length, 5);
  });

  it("check_consent_status returns the artifact for a known principal/purpose pair", async () => {
    const store = createSeededStore();
    const found = await store.findConsentArtifact("principal-1", "purpose-2");
    assert.equal(found?.id, "consent-1");
    assert.equal(found?.status, "granted");
  });

  it("returns null for a principal/purpose pair with no artifact", async () => {
    const store = createSeededStore();
    const found = await store.findConsentArtifact("principal-1", "purpose-3");
    assert.equal(found, null);
  });

  it("creates and then revokes a consent artifact, appending ledger entries", async () => {
    const store = createSeededStore();
    const before = (await store.listEntries()).length;

    const created = await store.createConsentArtifact({
      principalId: "principal-3",
      purposeId: "purpose-4",
      noticeVersion: "v1.3",
      language: "en",
    });
    assert.equal(created.status, "granted");

    const revoked = await store.revokeConsentArtifact(created.id, "test revoke");
    assert.equal(revoked.status, "withdrawn");
    assert.ok(revoked.withdrawnAt);

    const after = (await store.listEntries()).length;
    assert.equal(after, before + 2);

    const entries = await store.listEntries({ refId: created.id });
    assert.equal(entries.length, 2);
    assert.equal(entries[1]!.previousHash, entries[0]!.hash);
    assert.notEqual(entries[0]!.hash, entries[1]!.hash);
  });

  it("rejects revoking a consent artifact that isn't granted", async () => {
    const store = createSeededStore();
    // consent-4 is seeded as already withdrawn.
    await assert.rejects(() => store.revokeConsentArtifact("consent-4", "already withdrawn"));
  });

  it("rejects creating a consent artifact against a legitimate_use purpose", async () => {
    const store = createSeededStore();
    // purpose-3 ("Fraud prevention and security monitoring") is legitimate_use —
    // consent isn't a valid basis for it.
    await assert.rejects(
      () =>
        store.createConsentArtifact({
          principalId: "principal-1",
          purposeId: "purpose-3",
          noticeVersion: "v1.3",
          language: "en",
        }),
      /legitimate_use/,
    );
  });

  it("lists processors for a purpose and marks one for purge", async () => {
    const store = createSeededStore();
    const processors = await store.listProcessors({ purposeId: "purpose-4" });
    assert.equal(processors.length, 2);

    const before = (await store.listEntries()).length;
    const updated = await store.markProcessorForPurge(processors[0]!.id, "test purge");
    assert.equal(updated.status, "purge_pending");

    const after = (await store.listEntries()).length;
    assert.equal(after, before + 1);
  });
});

describe("DSRRepository", () => {
  it("creates a DSR request with a 30-day due date", async () => {
    const store = createSeededStore();
    const request = await store.createDSRRequest({ principalId: "principal-1", type: "access" });
    const diffDays = Math.round((request.dueAt.getTime() - request.submittedAt.getTime()) / (1000 * 60 * 60 * 24));
    assert.equal(diffDays, 30);
    assert.equal(request.status, "open");
  });

  it("filters DSR requests by type", async () => {
    const store = createSeededStore();
    await store.createDSRRequest({ principalId: "principal-1", type: "erasure" });
    await store.createDSRRequest({ principalId: "principal-2", type: "correction" });

    const erasureRequests = await store.listDSRRequests({ type: "erasure" });
    assert.ok(erasureRequests.length > 0);
    assert.ok(erasureRequests.every((r) => r.type === "erasure"));

    const correctionRequests = await store.listDSRRequests({ type: "correction" });
    assert.ok(correctionRequests.length > 0);
    assert.ok(correctionRequests.every((r) => r.type === "correction"));
  });
});

describe("LedgerRepository", () => {
  it("computes a compliance snapshot across consents, DSRs, and breaches", async () => {
    const store = createSeededStore();
    const snapshot = await store.getComplianceSnapshot({
      from: new Date("2026-01-01"),
      to: new Date("2026-12-31"),
    });
    assert.ok(snapshot.consentsGranted > 0);
    assert.ok(snapshot.dsrOverdue >= 1);
    assert.equal(snapshot.breachesLogged, 1);
  });

  it("seeds breach-1 with a high severity and its affected purpose", async () => {
    const store = createSeededStore();
    const breach = await store.findBreachEventById("breach-1");
    assert.equal(breach?.severity, "high");
    assert.deepEqual(breach?.affectedPurposeIds, ["purpose-1"]);
  });

  it("findBreachEventById returns null for an unknown id", async () => {
    const store = createSeededStore();
    assert.equal(await store.findBreachEventById("no-such-breach"), null);
  });

  it("createBreachEvent defaults affectedPurposeIds to [] when omitted", async () => {
    const store = createSeededStore();
    const breach = await store.createBreachEvent({
      description: "Test breach with no purposes recorded",
      detectedAt: new Date(),
      dpbNotifyDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      severity: "critical",
    });
    assert.deepEqual(breach.affectedPurposeIds, []);

    const found = await store.findBreachEventById(breach.id);
    assert.deepEqual(found?.affectedPurposeIds, []);
  });

  it("createBreachEvent preserves explicit affectedPurposeIds", async () => {
    const store = createSeededStore();
    const breach = await store.createBreachEvent({
      description: "Multi-purpose breach",
      detectedAt: new Date(),
      dpbNotifyDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      severity: "high",
      affectedPurposeIds: ["purpose-1", "purpose-2"],
    });
    assert.deepEqual(breach.affectedPurposeIds, ["purpose-1", "purpose-2"]);
  });

  it("seeds a valid hash chain, reported intact end to end", async () => {
    const store = createSeededStore();
    const entries = await store.listEntries();
    const report = await store.verifyLedgerIntegrity();
    assert.equal(report.intact, true);
    assert.equal(report.entriesChecked, entries.length);
    assert.equal(report.firstBreak, undefined);

    const first = entries.find((e) => e.sequence === 1);
    assert.equal(first?.previousHash, LEDGER_GENESIS_HASH);
  });

  it("stays intact after new entries are appended at runtime", async () => {
    const store = createSeededStore();
    await store.createDSRRequest({ principalId: "principal-1", type: "access" });
    await store.createConsentArtifact({
      principalId: "principal-2",
      purposeId: "purpose-1",
      noticeVersion: "v1.0",
      language: "en",
    });

    const report = await store.verifyLedgerIntegrity();
    assert.equal(report.intact, true);
  });

  it("entriesChecked respects a date range while still verifying the full chain", async () => {
    const store = createSeededStore();
    const allEntries = await store.listEntries();
    const report = await store.verifyLedgerIntegrity({ from: new Date("2026-01-01"), to: new Date("2026-12-31") });
    assert.equal(report.intact, true);
    assert.ok(report.entriesChecked > 0);
    assert.ok(report.entriesChecked <= allEntries.length);
  });

  it("the first call on a fresh store always walks the full chain", async () => {
    const store = createSeededStore();
    const entries = await store.listEntries();
    const report = await store.verifyLedgerIntegrity();
    assert.equal(report.verifiedFullChain, true);
    assert.equal(report.entriesChecked, entries.length);
  });

  it("a second call with no new entries only re-checks the delta (nothing)", async () => {
    const store = createSeededStore();
    await store.verifyLedgerIntegrity(); // sets the checkpoint

    const report = await store.verifyLedgerIntegrity();
    assert.equal(report.intact, true);
    assert.equal(report.verifiedFullChain, false);
    assert.equal(report.entriesChecked, 0);
  });

  it("after appending new entries, only the delta past the checkpoint is checked", async () => {
    const store = createSeededStore();
    await store.verifyLedgerIntegrity(); // sets the checkpoint at the current tail

    await store.createDSRRequest({ principalId: "principal-1", type: "access" });
    await store.createConsentArtifact({
      principalId: "principal-2",
      purposeId: "purpose-1",
      noticeVersion: "v1.0",
      language: "en",
    });

    const report = await store.verifyLedgerIntegrity();
    assert.equal(report.intact, true);
    assert.equal(report.verifiedFullChain, false);
    // 1 DSR creation + 1 consent grant = 2 new ledger entries since the checkpoint.
    assert.equal(report.entriesChecked, 2);
  });

  it("verifyFullChain: true forces a full walk from genesis even with a valid checkpoint", async () => {
    const store = createSeededStore();
    const entries = await store.listEntries();
    await store.verifyLedgerIntegrity(); // sets the checkpoint

    const report = await store.verifyLedgerIntegrity(undefined, true);
    assert.equal(report.intact, true);
    assert.equal(report.verifiedFullChain, true);
    assert.equal(report.entriesChecked, entries.length);
  });
});

describe("hash chain golden vectors", () => {
  // These exact hash strings are also hardcoded in
  // apps/api/test/hash-chain.spec.ts (apps/api's duplicated implementation
  // of this same algorithm — see hashChain.ts's header comment for why it's
  // duplicated rather than imported). If both test suites pass, the two
  // independently-maintained implementations agree.
  const GOLDEN_HASH_1 = "ef5ad3963759550ad1620268e41f7e9122c7ec8de9d3dbde5de82e1970f7235c";
  const GOLDEN_HASH_2 = "10cd7601ecfe8c6d2a728d18faff76a3e978a4ae6ccc8658de4216e11521130e";

  it("matches apps/api's implementation for the same fixture entries", () => {
    const entry1 = {
      id: "golden-1",
      sequence: 1,
      entryType: "consent_granted" as const,
      refId: "consent-golden",
      principalId: "principal-golden",
      detail: { purposeId: "purpose-golden" },
      recordedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const hash1 = computeLedgerEntryHash(LEDGER_GENESIS_HASH, entry1);
    assert.equal(hash1, GOLDEN_HASH_1);

    const entry2 = {
      id: "golden-2",
      sequence: 2,
      entryType: "consent_withdrawn" as const,
      refId: "consent-golden",
      principalId: "principal-golden",
      detail: { reason: "golden test" },
      recordedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    const hash2 = computeLedgerEntryHash(hash1, entry2);
    assert.equal(hash2, GOLDEN_HASH_2);
  });
});

describe("hash chain (verifyChain)", () => {
  function buildFixtureChain(): HashedLedgerEntry[] {
    const drafts = [
      {
        id: "fixture-1",
        sequence: 1,
        entryType: "consent_granted",
        refId: "consent-fixture",
        principalId: "principal-fixture",
        detail: { purposeId: "purpose-fixture" },
        recordedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "fixture-2",
        sequence: 2,
        entryType: "consent_withdrawn",
        refId: "consent-fixture",
        principalId: "principal-fixture",
        detail: { reason: "fixture" },
        recordedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ];
    let previousHash = LEDGER_GENESIS_HASH;
    return drafts.map((partial) => {
      const hash = computeLedgerEntryHash(previousHash, partial);
      const entry: HashedLedgerEntry = { ...partial, previousHash, hash };
      previousHash = hash;
      return entry;
    });
  }

  it("verifies an untampered chain as intact", () => {
    const result = verifyChain(buildFixtureChain());
    assert.equal(result.intact, true);
  });

  it("detects a tampered field via hash mismatch", () => {
    const chain = buildFixtureChain();
    chain[0]!.detail = { purposeId: "tampered" };
    const result = verifyChain(chain);
    assert.equal(result.intact, false);
    assert.equal(result.firstBreak?.sequence, 1);
    assert.equal(result.firstBreak?.reason, "hash_mismatch");
  });

  it("detects a broken previousHash link", () => {
    const chain = buildFixtureChain();
    chain[1]!.previousHash = "corrupted".padEnd(64, "0");
    const result = verifyChain(chain);
    assert.equal(result.intact, false);
    assert.equal(result.firstBreak?.sequence, 2);
    assert.equal(result.firstBreak?.reason, "previous_hash_mismatch");
  });
});
