import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../mock-store/index.js";

describe("seed data", () => {
  it("seeds the expected entity counts", async () => {
    const store = createSeededStore();
    assert.equal((await store.listPrincipals()).length, 8);
    assert.equal((await store.listPurposes()).length, 4);
    assert.equal((await store.listConsentArtifacts()).length, 11);
    assert.equal((await store.listDSRRequests()).length, 3);
    assert.equal((await store.listBreachEvents()).length, 1);
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
  });

  it("rejects revoking a consent artifact that isn't granted", async () => {
    const store = createSeededStore();
    // consent-4 is seeded as already withdrawn.
    await assert.rejects(() => store.revokeConsentArtifact("consent-4", "already withdrawn"));
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
});
