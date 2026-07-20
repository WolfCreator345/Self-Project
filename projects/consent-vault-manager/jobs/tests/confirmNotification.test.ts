import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeededStore } from "../../mock-store/index.js";
import { recordConfirmedNotification } from "../src/confirmNotification.js";
import type { PendingCalendarAction, PendingEmailAction, PendingReportAction } from "../src/pendingActions.js";

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

  it("writes a breach_notice_drafted ledger entry", async () => {
    const store = createSeededStore();

    const entry = await recordConfirmedNotification(store, {
      pending: {
        kind: "breach_notice_email",
        refId: "breach-1",
        recipientEmail: "dpb@example.gov",
        recipientName: "Data Protection Board",
        subject: "Personal Data Breach Notification",
        body: "...",
      },
      gmailDraftId: "fake-breach-draft-1",
      confirmedAt: new Date().toISOString(),
    });

    assert.equal(entry.entryType, "breach_notice_drafted");
    assert.equal(entry.refId, "breach-1");
  });

  it("writes a breach_notice_deadline_scheduled ledger entry", async () => {
    const store = createSeededStore();

    const pending: PendingCalendarAction = {
      kind: "breach_notice_deadline",
      refId: "breach-1",
      recipientEmail: "dpb@example.gov",
      recipientName: "Data Protection Board",
      summary: "DPB deadline",
      description: "...",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    };

    const entry = await recordConfirmedNotification(store, {
      pending,
      calendarEventId: "fake-breach-deadline-1",
      confirmedAt: new Date().toISOString(),
    });

    assert.equal(entry.entryType, "breach_notice_deadline_scheduled");
  });

  it("writes a dsr_escalation_sent ledger entry with the threshold in detail", async () => {
    const store = createSeededStore();

    const pending: PendingEmailAction = {
      kind: "dsr_escalation_email",
      refId: "dsr-2",
      principalId: "principal-5",
      recipientEmail: "dpo@example.com",
      recipientName: "Data Protection Office",
      threshold: "T-7d",
      subject: "DSR SLA alert",
      body: "...",
    };

    const entry = await recordConfirmedNotification(store, {
      pending,
      gmailDraftId: "fake-escalation-draft-1",
      confirmedAt: new Date().toISOString(),
    });

    assert.equal(entry.entryType, "dsr_escalation_sent");
    const detail = entry.detail as { threshold: string };
    assert.equal(detail.threshold, "T-7d");
  });

  it("writes a weekly_report_sent ledger entry with both gmailDraftId and driveFileId", async () => {
    const store = createSeededStore();

    const pending: PendingReportAction = {
      kind: "weekly_report",
      refId: "weekly-report-2026-07-13-2026-07-20",
      recipientEmail: "dpo@example.com",
      recipientName: "Data Protection Office",
      subject: "Weekly compliance report",
      body: "...",
      pdfBase64: "ZmFrZQ==",
      pdfFilename: "report.pdf",
    };

    const entry = await recordConfirmedNotification(store, {
      pending,
      gmailDraftId: "fake-report-draft-1",
      driveFileId: "fake-drive-file-1",
      confirmedAt: new Date().toISOString(),
    });

    assert.equal(entry.entryType, "weekly_report_sent");
    const detail = entry.detail as { gmailDraftId: string; driveFileId: string };
    assert.equal(detail.gmailDraftId, "fake-report-draft-1");
    assert.equal(detail.driveFileId, "fake-drive-file-1");
  });

  it("rejects a weekly_report confirmation missing driveFileId", async () => {
    const store = createSeededStore();

    const pending: PendingReportAction = {
      kind: "weekly_report",
      refId: "weekly-report-2026-07-13-2026-07-20",
      recipientEmail: "dpo@example.com",
      recipientName: "Data Protection Office",
      subject: "Weekly compliance report",
      body: "...",
      pdfBase64: "ZmFrZQ==",
      pdfFilename: "report.pdf",
    };

    await assert.rejects(() =>
      recordConfirmedNotification(store, {
        pending,
        gmailDraftId: "fake-report-draft-1",
        confirmedAt: new Date().toISOString(),
      }),
    );
  });
});
