#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createRealRepositories } from "../../apps/api/src/consent-vault/create-real-repositories.js";
import type { DSRType } from "../../mock-store/index.js";

/**
 * Phase 5 cutover: wired to the real Prisma-backed repositories from
 * apps/api instead of mock-store's in-memory createSeededStore(). Nothing
 * about the tool definitions below changed — only what's behind them.
 * mock-store's single combined object became three separate instances
 * (consent/dsr/ledger), so each handler now calls the one that owns that
 * method instead of a shared `store`.
 */
const { prisma, consent, dsr, ledger } = await createRealRepositories();

const server = new McpServer({
  name: "consent-vault",
  version: "0.1.0",
});

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

// ─── create_consent_record ─────────────────────────────────────────────────
// Write action: mutates vault state. Expect a confirmation prompt from the
// calling client before this actually runs.
server.registerTool(
  "create_consent_record",
  {
    title: "Create consent record",
    description:
      "Record that a data principal has granted consent for a purpose. Mutates vault state — " +
      "the calling client should confirm with the user before invoking this.",
    inputSchema: {
      principal_id: z.string().describe("id of the DataPrincipal granting consent"),
      purpose_id: z.string().describe("id of the Purpose being consented to"),
      notice_version: z.string().describe("version identifier of the privacy notice shown at consent time"),
      language: z.string().default("en").describe("language the notice was presented in, e.g. 'en', 'hi'"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async ({ principal_id, purpose_id, notice_version, language }) => {
    try {
      const artifact = await consent.createConsentArtifact({
        principalId: principal_id,
        purposeId: purpose_id,
        noticeVersion: notice_version,
        language,
      });
      return ok(artifact);
    } catch (error) {
      return fail(error);
    }
  },
);

// ─── revoke_consent ─────────────────────────────────────────────────────────
// Write action: mutates vault state. Expect a confirmation prompt.
server.registerTool(
  "revoke_consent",
  {
    title: "Revoke consent",
    description:
      "Withdraw a previously granted consent artifact and write a ledger entry recording why. " +
      "Only valid for artifacts currently in 'granted' status. Mutates vault state — the calling " +
      "client should confirm with the user before invoking this.",
    inputSchema: {
      consent_id: z.string().describe("id of the ConsentArtifact to revoke"),
      reason: z.string().describe("why the consent is being withdrawn, recorded on the ledger entry"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  async ({ consent_id, reason }) => {
    try {
      const artifact = await consent.revokeConsentArtifact(consent_id, reason);
      return ok(artifact);
    } catch (error) {
      return fail(error);
    }
  },
);

// ─── check_consent_status ───────────────────────────────────────────────────
server.registerTool(
  "check_consent_status",
  {
    title: "Check consent status",
    description:
      "Look up the most recent consent artifact for a principal/purpose pair. Returns null if no " +
      "consent has ever been recorded for that pair. Read-only.",
    inputSchema: {
      principal_id: z.string().describe("id of the DataPrincipal"),
      purpose_id: z.string().describe("id of the Purpose"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async ({ principal_id, purpose_id }) => {
    try {
      const artifact = await consent.findConsentArtifact(principal_id, purpose_id);
      return ok(artifact);
    } catch (error) {
      return fail(error);
    }
  },
);

// ─── list_open_dsr_requests ─────────────────────────────────────────────────
server.registerTool(
  "list_open_dsr_requests",
  {
    title: "List open DSR requests",
    description:
      "List Data Subject Rights requests that are not yet resolved (status is 'open', 'in_progress', " +
      "or 'overdue'). Set overdue_only to true to see only requests past their due date. Read-only.",
    inputSchema: {
      overdue_only: z.boolean().default(false).describe("if true, only return requests past their dueAt date"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async ({ overdue_only }) => {
    try {
      const requests = await dsr.listDSRRequests(overdue_only ? { overdueOnly: true } : undefined);
      const open = requests.filter((request) => request.status !== "resolved");
      return ok(open);
    } catch (error) {
      return fail(error);
    }
  },
);

// ─── create_dsr_request ──────────────────────────────────────────────────────
// Write action: mutates vault state. Expect a confirmation prompt.
const DSR_TYPES = ["access", "correction", "erasure", "nomination"] as const satisfies readonly DSRType[];

server.registerTool(
  "create_dsr_request",
  {
    title: "Create DSR request",
    description:
      "Open a new Data Subject Rights request for a principal (access / correction / erasure / " +
      "nomination) with a due date computed from the standard SLA. Mutates vault state — the " +
      "calling client should confirm with the user before invoking this.",
    inputSchema: {
      principal_id: z.string().describe("id of the DataPrincipal submitting the request"),
      type: z.enum(DSR_TYPES).describe("kind of DSR request being submitted"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async ({ principal_id, type }) => {
    try {
      const request = await dsr.createDSRRequest({ principalId: principal_id, type });
      return ok(request);
    } catch (error) {
      return fail(error);
    }
  },
);

// ─── get_compliance_snapshot ─────────────────────────────────────────────────
server.registerTool(
  "get_compliance_snapshot",
  {
    title: "Get compliance snapshot",
    description:
      "Summarize consent grants/withdrawals/expirations, DSR queue state, and breach events recorded " +
      "within a date range. Read-only.",
    inputSchema: {
      from: z.string().describe("ISO 8601 date/time — start of the range, inclusive"),
      to: z.string().describe("ISO 8601 date/time — end of the range, inclusive"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async ({ from, to }) => {
    try {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (Number.isNaN(fromDate.getTime())) throw new Error(`Invalid "from" date: ${from}`);
      if (Number.isNaN(toDate.getTime())) throw new Error(`Invalid "to" date: ${to}`);
      const snapshot = await ledger.getComplianceSnapshot({ from: fromDate, to: toDate });
      return ok(snapshot);
    } catch (error) {
      return fail(error);
    }
  },
);

// ─── verify_ledger_integrity ─────────────────────────────────────────────────
// Phase 5: walks the hash chain from genesis and reports whether it's
// intact, plus the first broken link (if any). Read-only.
server.registerTool(
  "verify_ledger_integrity",
  {
    title: "Verify ledger integrity",
    description:
      "Recompute the ConsentLedgerEntry hash chain from genesis and confirm it's unbroken. Optional " +
      "from/to only narrow which entries count toward entriesChecked in the report — the chain is " +
      "always verified in full, since a link can't be trusted in isolation from what came before it. " +
      "Read-only.",
    inputSchema: {
      from_date: z.string().optional().describe("ISO 8601 date/time — only affects entriesChecked, not what's verified"),
      to_date: z.string().optional().describe("ISO 8601 date/time — only affects entriesChecked, not what's verified"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async ({ from_date, to_date }) => {
    try {
      let dateRange: { from: Date; to: Date } | undefined;
      if (from_date || to_date) {
        if (!from_date || !to_date) throw new Error("Provide both from_date and to_date, or neither.");
        const fromDate = new Date(from_date);
        const toDate = new Date(to_date);
        if (Number.isNaN(fromDate.getTime())) throw new Error(`Invalid "from_date": ${from_date}`);
        if (Number.isNaN(toDate.getTime())) throw new Error(`Invalid "to_date": ${to_date}`);
        dateRange = { from: fromDate, to: toDate };
      }
      const report = await ledger.verifyLedgerIntegrity(dateRange);
      return ok(report);
    } catch (error) {
      return fail(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
