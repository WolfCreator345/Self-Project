import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../../mock-store/index.js";
import { runDsrSlaEscalation, type DsrSlaThreshold } from "../src/dsrSlaEscalation.js";
import type { PendingAction } from "../src/pendingActions.js";

process.env.SELF_NOTIFICATION_EMAIL = "dpo@example.com";

function fakeDedupTracker() {
  const seen = new Set<string>();
  return {
    key: (dsrRequestId: string, threshold: DsrSlaThreshold) => `${dsrRequestId}:${threshold}`,
    hasPendingOrSent: async function (dsrRequestId: string, threshold: DsrSlaThreshold) {
      return seen.has(`${dsrRequestId}:${threshold}`);
    },
    markSeen(dsrRequestId: string, threshold: DsrSlaThreshold) {
      seen.add(`${dsrRequestId}:${threshold}`);
    },
  };
}

function collector() {
  const staged: PendingAction[] = [];
  return { staged, stage: async (action: PendingAction) => void staged.push(action) };
}

describe("runDsrSlaEscalation", () => {
  it("escalates the seeded overdue DSR (dsr-2) at both thresholds, not the ones with plenty of time left", async () => {
    const store = createSeededStore();
    const dedup = fakeDedupTracker();
    const { staged, stage } = collector();

    const result = await runDsrSlaEscalation(store, dedup.hasPendingOrSent, stage);

    const dsr2Thresholds = result.escalated.filter((e) => e.dsrRequestId === "dsr-2").map((e) => e.threshold);
    assert.deepEqual([...dsr2Thresholds].sort(), ["T-2d", "T-7d"]);
    assert.ok(!result.escalated.some((e) => e.dsrRequestId === "dsr-1"));
    assert.ok(!result.escalated.some((e) => e.dsrRequestId === "dsr-3"));

    assert.equal(staged.length, result.escalated.length);
    for (const action of staged) {
      assert.equal(action.kind, "dsr_escalation_email");
      assert.equal(action.recipientEmail, "dpo@example.com");
      if (action.kind === "dsr_escalation_email") {
        assert.equal(action.refId, "dsr-2");
        assert.ok(action.threshold === "T-7d" || action.threshold === "T-2d");
      }
    }
  });

  it("does not re-stage an escalation already marked as pending/sent", async () => {
    const store = createSeededStore();
    const dedup = fakeDedupTracker();
    dedup.markSeen("dsr-2", "T-7d");
    dedup.markSeen("dsr-2", "T-2d");

    const result = await runDsrSlaEscalation(store, dedup.hasPendingOrSent, collector().stage);
    assert.equal(result.escalated.length, 0);
  });

  it("requires SELF_NOTIFICATION_EMAIL to be set", async () => {
    const store = createSeededStore();
    const original = process.env.SELF_NOTIFICATION_EMAIL;
    delete process.env.SELF_NOTIFICATION_EMAIL;
    try {
      await assert.rejects(() => runDsrSlaEscalation(store, fakeDedupTracker().hasPendingOrSent, collector().stage));
    } finally {
      process.env.SELF_NOTIFICATION_EMAIL = original;
    }
  });
});
