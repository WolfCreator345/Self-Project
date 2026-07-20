import type { TDocumentDefinitions } from "pdfmake/interfaces.js";

import type { LedgerRepository } from "../../mock-store/index.js";
import { logStaged } from "./notify.js";
import { createPdfPrinter, renderPdfToBuffer } from "./pdfPrinter.js";
import type { PendingReportAction, StagePendingAction } from "./pendingActions.js";

const REPORT_WINDOW_DAYS = 7;

export interface WeeklyComplianceReportResult {
  from: Date;
  to: Date;
  pdfBytes: number;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDocDefinition(
  dateRange: { from: Date; to: Date },
  snapshot: Awaited<ReturnType<LedgerRepository["getComplianceSnapshot"]>>,
): TDocumentDefinitions {
  return {
    defaultStyle: { font: "Helvetica" },
    content: [
      { text: "Weekly Compliance Report", style: "header" },
      { text: `${isoDate(dateRange.from)} — ${isoDate(dateRange.to)}`, style: "subheader", margin: [0, 0, 0, 16] },
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto"],
          body: [
            ["Metric", "Count"],
            ["Consents granted", String(snapshot.consentsGranted)],
            ["Consents withdrawn", String(snapshot.consentsWithdrawn)],
            ["Consents expired", String(snapshot.consentsExpired)],
            ["DSR requests open", String(snapshot.dsrOpen)],
            ["DSR requests overdue", String(snapshot.dsrOverdue)],
            ["DSR requests resolved", String(snapshot.dsrResolved)],
            ["Breaches logged", String(snapshot.breachesLogged)],
          ],
        },
      },
      { text: "Generated automatically by the Consent Vault Manager.", style: "footer", margin: [0, 16, 0, 0] },
    ],
    styles: {
      header: { fontSize: 18, bold: true },
      subheader: { fontSize: 11, color: "#555555" },
      footer: { fontSize: 9, italics: true, color: "#888888" },
    },
  };
}

/**
 * Snapshots the last 7 days of compliance data (the same shape
 * get_compliance_snapshot returns over MCP) and renders it as a PDF via
 * pdfmake — no headless-browser dependency, per the Phase 7 brief. Stages a
 * single weekly_report pending action carrying the PDF inline (base64) for
 * a human to actually archive to Drive and email, then confirm with both
 * ids together (see confirmNotification.ts). Pure function over a
 * LedgerRepository (plus injected staging callback), unit-testable against
 * mock-store without Redis/Postgres.
 */
export async function runWeeklyComplianceReport(
  ledger: LedgerRepository,
  stagePendingAction: StagePendingAction,
): Promise<WeeklyComplianceReportResult> {
  const selfEmail = process.env.SELF_NOTIFICATION_EMAIL;
  if (!selfEmail) {
    throw new Error("SELF_NOTIFICATION_EMAIL must be set — the weekly compliance report is emailed to the fiduciary's own inbox.");
  }

  const to = new Date();
  const from = new Date(to.getTime() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const dateRange = { from, to };

  const snapshot = await ledger.getComplianceSnapshot(dateRange);
  const printer = createPdfPrinter();
  const pdfBuffer = await renderPdfToBuffer(printer, buildDocDefinition(dateRange, snapshot));

  const pdfFilename = `compliance-report-${isoDate(from)}-to-${isoDate(to)}.pdf`;
  const action: PendingReportAction = {
    kind: "weekly_report",
    refId: `weekly-report-${isoDate(from)}-${isoDate(to)}`,
    recipientEmail: selfEmail,
    recipientName: "Data Protection Office",
    subject: `Weekly compliance report — ${isoDate(from)} to ${isoDate(to)}`,
    body:
      `Weekly compliance snapshot for ${isoDate(from)} to ${isoDate(to)}:\n\n` +
      `Consents granted: ${snapshot.consentsGranted}\n` +
      `Consents withdrawn: ${snapshot.consentsWithdrawn}\n` +
      `Consents expired: ${snapshot.consentsExpired}\n` +
      `DSR open: ${snapshot.dsrOpen}, overdue: ${snapshot.dsrOverdue}, resolved: ${snapshot.dsrResolved}\n` +
      `Breaches logged: ${snapshot.breachesLogged}\n\n` +
      `Full report archived to Drive as "${pdfFilename}" — link the uploaded file when creating the real draft.`,
    pdfBase64: pdfBuffer.toString("base64"),
    pdfFilename,
  };
  await stagePendingAction(action);

  logStaged(`weekly compliance report for ${isoDate(from)}–${isoDate(to)} (${pdfBuffer.length} bytes) — awaiting confirmation`);

  return { from, to, pdfBytes: pdfBuffer.length };
}
