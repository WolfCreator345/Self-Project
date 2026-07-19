import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../../mock-store/index.js";
import { recordConfirmedNotification } from "../src/confirmNotification.js";
import type { PendingCalendarAction, PendingEmailAction } from "../src/pendingActions.js";

describe("recordConfirmedNotification", () => {
  it("writes a renewal_email_drafted ledger entry with the real gmail draft id", async () => {
    const store = createSeededStore();
    const before = (await store.listEntries()).length;

    const pending: PendingEmailAction = {
      kind: "renewal_email",
      refId: "consent-12",
      principalId: "principal-7",
      recipientEmail: "fatima.khan@example.com",
      recipientName: "Fatima Khan",
      subject: "Action required: renew your consent",
      body: "...",
    };

    const entry = await recordConfirmedNotification(store, {
      pending,
      gmailDraftId: "r-fake-draft-id-1",
      confirmedAt: new Date().toISOString(),
    });

    assert.equal(entry.entryType, "renewal_email_drafted");
    assert.equal(entry.refId, "consent-12");
    assert.equal(entry.principalId, "principal-7");
    const detail = entry.detail as { gmailDraftId: string; recipientEmail: string; messageType: string };
    assert.equal(detail.gmailDraftId, "r-fake-draft-id-1");
    assert.equal(detail.recipientEmail, "fatima.khan@example.com");
    assert.equal(detail.messageType, "renewal_email");

    assert.equal((await store.listEntries()).length, before + 1);
  });

  it("writes a purge_followup_event_scheduled ledger entry with the real calendar event id", async () => {
    const store = createSeededStore();

    const pending: PendingCalendarAction = {
      kind: "purge_followup_event",
      refId: "processor-5",
      principalId: "principal-2",
      recipientEmail: "dpo@pixelmetrics.example",
      recipientName: "PixelMetrics Analytics",
      summary: "Confirm data purge",
      description: "...",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    };

    const entry = await recordConfirmedNotification(store, {
      pending,
      calendarEventId: "fake-calendar-event-id-1",
      confirmedAt: new Date().toISOString(),
    });

    assert.equal(entry.entryType, "purge_followup_event_scheduled");
    assert.equal(entry.refId, "processor-5");
    const detail = entry.detail as { calendarEventId: string };
    assert.equal(detail.calendarEventId, "fake-calendar-event-id-1");
  });

  it("writes a purge_notice_email_drafted ledger entry", async () => {
    const store = createSeededStore();

    const entry = await recordConfirmedNotification(store, {
      pending: {
        kind: "purge_notice_email",
        refId: "processor-1",
        recipientEmail: "privacy@mailblastcrm.example",
        recipientName: "MailBlast CRM",
        subject: "Data purge required",
        body: "...",
      },
      gmailDraftId: "fake-draft-2",
      confirmedAt: new Date().toISOString(),
    });

    assert.equal(entry.entryType, "purge_notice_email_drafted");
    assert.equal(entry.refId, "processor-1");
  });
});
