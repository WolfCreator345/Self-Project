import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../../mock-store/index.js";
import { runExpirySweep } from "../src/expirySweep.js";

describe("runExpirySweep", () => {
  it("expires the one seeded stale granted artifact and leaves the rest alone", async () => {
    const store = createSeededStore();
    const before = (await store.listEntries()).length;

    const result = await runExpirySweep(store);

    assert.deepEqual(result.expired, ["consent-12"]);

    const artifact = await store.findConsentArtifactById("consent-12");
    assert.equal(artifact?.status, "expired");

    const after = (await store.listEntries()).length;
    assert.equal(after, before + 1);

    const entries = await store.listEntries({ refId: "consent-12", entryType: "consent_expired" });
    assert.equal(entries.length, 1);
    const detail = entries[0]!.detail as { previousStatus: string; newStatus: string; changedAt: string };
    assert.equal(detail.previousStatus, "granted");
    assert.equal(detail.newStatus, "expired");
    assert.ok(detail.changedAt);
  });

  it("is a no-op on a second run once the stale artifact has already been swept", async () => {
    const store = createSeededStore();
    await runExpirySweep(store);

    const before = (await store.listEntries()).length;
    const result = await runExpirySweep(store);

    assert.deepEqual(result.expired, []);
    assert.equal((await store.listEntries()).length, before);
  });

  it("does not touch already-expired or withdrawn artifacts", async () => {
    const store = createSeededStore();
    await runExpirySweep(store);

    // consent-2 and consent-9 are seeded as already "expired"; consent-4/6/10 as "withdrawn".
    for (const id of ["consent-2", "consent-9", "consent-4", "consent-6", "consent-10"]) {
      const before = await store.findConsentArtifactById(id);
      assert.ok(before);
    }
    const stillGranted = await store.listConsentArtifacts({ status: "granted" });
    // None of the still-granted artifacts should have an expiresAt in the past.
    const now = new Date();
    for (const artifact of stillGranted) {
      assert.ok(artifact.expiresAt.getTime() > now.getTime());
    }
  });
});
