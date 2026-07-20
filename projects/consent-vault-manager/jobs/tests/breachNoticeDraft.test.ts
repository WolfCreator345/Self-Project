import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../../mock-store/index.js";
import { runBreachNoticeDraft } from "../src/breachNoticeDraft.js";
import type { PendingAction } from "../src/pendingActions.js";

process.env.DPB_NOTIFICATION_EMAIL = "dpb@example.gov";

function collector() {
  const staged: PendingAction[] = [];
  return { staged, stage: async (action: PendingAction) => void staged.push(action) };
}

describe("runBreachNoticeDraft", () => {
  it("drafts a DPB notice email and a deadline event for the seeded high-severity breach", async () => {
    const store = createSeededStore();
    const { staged, stage } = collector();

    const result = await runBreachNoticeDraft(store, store, { breachEventId: "breach-1" }, stage);

    assert.equal(result.breachEventId, "breach-1");
    assert.equal(result.affectedPurposeCount, 1);
    assert.ok(result.affectedPrincipalCount > 0);

    assert.equal(staged.length, 2);
    const email = staged.find((a) => a.kind === "breach_notice_email");
    const deadline = staged.find((a) => a.kind === "breach_notice_deadline");
    assert.ok(email && deadline);

    if (email?.kind === "breach_notice_email") {
      assert.equal(email.refId, "breach-1");
      assert.equal(email.recipientEmail, "dpb@example.gov");
      assert.ok(email.body.includes("Digital Personal Data Protection Act"));
      assert.ok(email.body.includes("Marketing communications and promotional offers"));
    }
    if (deadline?.kind === "breach_notice_deadline") {
      assert.equal(deadline.refId, "breach-1");
      const breach = await store.findBreachEventById("breach-1");
      assert.equal(deadline.startTime, breach?.dpbNotifyDueAt.toISOString());
    }
  });

  it("rejects a low/medium severity breach", async () => {
    const store = createSeededStore();
    const breach = await store.createBreachEvent({
      description: "Minor logging issue",
      detectedAt: new Date(),
      dpbNotifyDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      severity: "low",
    });

    await assert.rejects(() => runBreachNoticeDraft(store, store, { breachEventId: breach.id }, collector().stage));
  });

  it("throws for an unknown breach event id", async () => {
    const store = createSeededStore();
    await assert.rejects(() => runBreachNoticeDraft(store, store, { breachEventId: "no-such-breach" }, collector().stage));
  });

  it("requires DPB_NOTIFICATION_EMAIL to be set", async () => {
    const store = createSeededStore();
    const original = process.env.DPB_NOTIFICATION_EMAIL;
    delete process.env.DPB_NOTIFICATION_EMAIL;
    try {
      await assert.rejects(() => runBreachNoticeDraft(store, store, { breachEventId: "breach-1" }, collector().stage));
    } finally {
      process.env.DPB_NOTIFICATION_EMAIL = original;
    }
  });
});
