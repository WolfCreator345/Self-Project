import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../../mock-store/index.js";
import { runWithdrawalCascade } from "../src/withdrawalCascade.js";

describe("runWithdrawalCascade", () => {
  it("flags every active processor tied to the withdrawn consent's purpose", async () => {
    const store = createSeededStore();
    // consent-4: principal-2, purpose-4 (analytics), seeded status "withdrawn".
    // purpose-4 has 2 seeded active processors: processor-5, processor-6.
    const before = (await store.listEntries()).length;

    const result = await runWithdrawalCascade(store, { consentId: "consent-4" });

    assert.equal(result.consentId, "consent-4");
    assert.deepEqual(result.flaggedProcessorIds.sort(), ["processor-5", "processor-6"]);

    const processors = await store.listProcessors({ purposeId: "purpose-4" });
    for (const processor of processors) {
      assert.equal(processor.status, "purge_pending");
    }

    const after = (await store.listEntries()).length;
    assert.equal(after, before + 2);

    const entries = await store.listEntries({ entryType: "processor_purge_flagged" });
    assert.equal(entries.length, 2);
    for (const entry of entries) {
      const detail = entry.detail as { purposeId: string; processorName: string; reason: string };
      assert.equal(detail.purposeId, "purpose-4");
      assert.ok(detail.reason.includes("consent-4"));
    }
  });

  it("is idempotent: a second run finds no more active processors to flag", async () => {
    const store = createSeededStore();
    await runWithdrawalCascade(store, { consentId: "consent-4" });
    const before = (await store.listEntries()).length;

    // Processors are now "purge_pending", not "active", so the active-only
    // filter means the second run flags nothing new.
    const result = await runWithdrawalCascade(store, { consentId: "consent-4" });
    assert.deepEqual(result.flaggedProcessorIds, []);
    assert.equal((await store.listEntries()).length, before);
  });

  it("throws for an unknown consent id", async () => {
    const store = createSeededStore();
    await assert.rejects(() => runWithdrawalCascade(store, { consentId: "does-not-exist" }));
  });
});
