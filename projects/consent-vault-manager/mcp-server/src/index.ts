#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createSeededStore, type DSRType } from "../../mock-store/index.js";

/**
 * Phase 1: this server is wired to the in-memory mock store, not a real
 * database. State only lives for the lifetime of this process — restarting
 * the server resets it back to the seeded data. Phase 4 swaps this for a
 * Postgres-backed ConsentRepository/DSRRepository/LedgerRepository without
 * touching the tool definitions below.
 */
const store = createSeededStore();

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
      const artifact = await store.createConsentArtifact({
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
      const artifact = await store.revokeConsentArtifact(consent_id, reason);
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
      const artifact = await store.findConsentArtifact(principal_id, purpose_id);
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
      const requests = await store.listDSRRequests(overdue_only ? { overdueOnly: true } : undefined);
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
      const request = await store.createDSRRequest({ principalId: principal_id, type });
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
      const snapshot = await store.getComplianceSnapshot({ from: fromDate, to: toDate });
      return ok(snapshot);
    } catch (error) {
      return fail(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
