import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../../mock-store/index.js";
import type { PendingAction } from "../src/pendingActions.js";
import { runWithdrawalCascade } from "../src/withdrawalCascade.js";

function collector() {
  const staged: PendingAction[] = [];
  return { staged, stage: async (action: PendingAction) => void staged.push(action) };
}

describe("runWithdrawalCascade", () => {
  it("flags every active processor and stages an email + calendar event for each", async () => {
    const store = createSeededStore();
    // consent-4: principal-2, purpose-4 (analytics), seeded status "withdrawn".
    // purpose-4 has 2 seeded active processors: processor-5, processor-6.
    const before = (await store.listEntries()).length;
    const { staged, stage } = collector();

    const result = await runWithdrawalCascade(store, { consentId: "consent-4" }, stage);

    assert.equal(result.consentId, "consent-4");
    assert.deepEqual(result.flaggedProcessorIds.sort(), ["processor-5", "processor-6"]);

    const processors = await store.listProcessors({ purposeId: "purpose-4" });
    for (const processor of processors) {
      assert.equal(processor.status, "purge_pending");
    }

    // 2 processor_purge_flagged ledger entries from store.markProcessorForPurge —
    // staging drafts does not itself touch the ledger.
    const after = (await store.listEntries()).length;
    assert.equal(after, before + 2);

    assert.equal(staged.length, 4); // 2 processors x (1 email + 1 calendar event)
    const emails = staged.filter((a) => a.kind === "purge_notice_email");
    const events = staged.filter((a) => a.kind === "purge_followup_event");
    assert.equal(emails.length, 2);
    assert.equal(events.length, 2);

    for (const email of emails) {
      assert.ok(["processor-5", "processor-6"].includes(email.refId));
      assert.match(email.recipientEmail, /@/);
    }
    for (const event of events) {
      if (event.kind !== "purge_followup_event") continue;
      const start = new Date(event.startTime);
      const daysOut = Math.round((start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      assert.equal(daysOut, 7);
      assert.ok(new Date(event.endTime).getTime() > start.getTime());
    }
  });

  it("is idempotent: a second run finds no more active processors to flag or stage", async () => {
    const store = createSeededStore();
    await runWithdrawalCascade(store, { consentId: "consent-4" }, collector().stage);

    const before = (await store.listEntries()).length;
    const { staged, stage } = collector();

    // Processors are now "purge_pending", not "active", so the active-only
    // filter means the second run flags/stages nothing new.
    const result = await runWithdrawalCascade(store, { consentId: "consent-4" }, stage);
    assert.deepEqual(result.flaggedProcessorIds, []);
    assert.equal(staged.length, 0);
    assert.equal((await store.listEntries()).length, before);
  });

  it("throws for an unknown consent id", async () => {
    const store = createSeededStore();
    await assert.rejects(() => runWithdrawalCascade(store, { consentId: "does-not-exist" }, collector().stage));
  });
});
