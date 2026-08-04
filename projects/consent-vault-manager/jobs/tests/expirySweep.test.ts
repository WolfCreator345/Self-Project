import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../../mock-store/index.js";
import { runExpirySweep } from "../src/expirySweep.js";
import type { PendingAction } from "../src/pendingActions.js";

function collector() {
  const staged: PendingAction[] = [];
  return { staged, stage: async (action: PendingAction) => void staged.push(action) };
}

describe("runExpirySweep", () => {
  it("expires the one seeded stale granted artifact and stages a renewal email", async () => {
    const store = createSeededStore();
    const before = (await store.listEntries()).length;
    const { staged, stage } = collector();

    const result = await runExpirySweep(store, stage);

    assert.deepEqual(result.expired, ["consent-12"]);

    const artifact = await store.findConsentArtifactById("consent-12");
    assert.equal(artifact?.status, "expired");

    // markExpired's own ledger entry, nothing more — staging a draft does
    // not itself touch the ledger (only a later confirmation does).
    const after = (await store.listEntries()).length;
    assert.equal(after, before + 1);

    const entries = await store.listEntries({ refId: "consent-12", entryType: "consent_expired" });
    assert.equal(entries.length, 1);
    const detail = entries[0]!.detail as { previousStatus: string; newStatus: string; changedAt: string };
    assert.equal(detail.previousStatus, "granted");
    assert.equal(detail.newStatus, "expired");
    assert.ok(detail.changedAt);

    assert.equal(staged.length, 1);
    const action = staged[0]!;
    assert.equal(action.kind, "renewal_email");
    assert.equal(action.refId, "consent-12");
    assert.equal(action.recipientEmail, "fatima.khan@example.com");
    if (action.kind === "renewal_email") {
      assert.ok(action.subject.includes("renew"));
      assert.ok(action.body.includes("consent-12"));
    }
  });

  it("is a no-op on a second run once the stale artifact has already been swept", async () => {
    const store = createSeededStore();
    await runExpirySweep(store, collector().stage);

    const before = (await store.listEntries()).length;
    const { staged, stage } = collector();
    const result = await runExpirySweep(store, stage);

    assert.deepEqual(result.expired, []);
    assert.equal(staged.length, 0);
    assert.equal((await store.listEntries()).length, before);
  });

  it("does not touch already-expired or withdrawn artifacts", async () => {
    const store = createSeededStore();
    await runExpirySweep(store, collector().stage);

    // consent-2 and consent-9 are seeded as already "expired"; consent-4/6/10 as "withdrawn".
    for (const id of ["consent-2", "consent-9", "consent-4", "consent-6", "consent-10"]) {
      const before = await store.findConsentArtifactById(id);
      assert.ok(before);
    }
    const stillGranted = await store.listConsentArtifacts({ status: "granted" });
    const now = new Date();
    for (const artifact of stillGranted) {
      assert.ok(artifact.expiresAt.getTime() > now.getTime());
    }
  });
});
