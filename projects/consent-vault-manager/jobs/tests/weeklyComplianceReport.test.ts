import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../../mock-store/index.js";
import type { PendingAction } from "../src/pendingActions.js";
import { runWeeklyComplianceReport } from "../src/weeklyComplianceReport.js";

process.env.SELF_NOTIFICATION_EMAIL = "dpo@example.com";

function collector() {
  const staged: PendingAction[] = [];
  return { staged, stage: async (action: PendingAction) => void staged.push(action) };
}

describe("runWeeklyComplianceReport", () => {
  it("stages a weekly_report action carrying a valid PDF spanning the last 7 days", async () => {
    const store = createSeededStore();
    const { staged, stage } = collector();

    const result = await runWeeklyComplianceReport(store, stage);

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(result.to.getTime() - result.from.getTime() - sevenDaysMs) < 1000);
    assert.ok(result.pdfBytes > 0);

    assert.equal(staged.length, 1);
    const action = staged[0]!;
    assert.equal(action.kind, "weekly_report");
    assert.equal(action.recipientEmail, "dpo@example.com");
    if (action.kind === "weekly_report") {
      assert.ok(action.pdfFilename.endsWith(".pdf"));
      const buffer = Buffer.from(action.pdfBase64, "base64");
      assert.equal(buffer.length, result.pdfBytes);
      // PDF file signature.
      assert.equal(buffer.subarray(0, 5).toString("ascii"), "%PDF-");
      assert.ok(action.body.includes(action.pdfFilename));
    }
  });

  it("requires SELF_NOTIFICATION_EMAIL to be set", async () => {
    const store = createSeededStore();
    const original = process.env.SELF_NOTIFICATION_EMAIL;
    delete process.env.SELF_NOTIFICATION_EMAIL;
    try {
      await assert.rejects(() => runWeeklyComplianceReport(store, collector().stage));
    } finally {
      process.env.SELF_NOTIFICATION_EMAIL = original;
    }
  });
});
