import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { PrismaService } from "../../apps/api/src/prisma/prisma.service.js";
import { resetDatabase } from "../../apps/api/test/test-db.js";

/**
 * Spawns the server exactly as .mcp.json would (same relative command/args,
 * cwd = repo root) and drives all seven tools over a real MCP connection —
 * not a typecheck, an actual client/server round trip against the real
 * Postgres-backed repositories (Phase 5 cutover; this used to run against
 * an ephemeral mock store, fresh on every server start — Postgres data
 * persists across runs, so this now reseeds first to stay repeatable).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// mcp-server/scripts -> mcp-server -> consent-vault-manager -> projects -> repo root
const repoRoot = path.resolve(__dirname, "../../../..");

const client = new Client({ name: "consent-vault-smoke-test", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: "projects/consent-vault-manager/mcp-server/node_modules/.bin/tsx",
  args: ["projects/consent-vault-manager/mcp-server/src/index.ts"],
  cwd: repoRoot,
});

function textOf(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const content = result.content as Array<{ type: string; text?: string }>;
  const first = content[0];
  assert.ok(first && first.type === "text" && typeof first.text === "string", "expected a text content block");
  return JSON.parse(first.text!);
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  await resetDatabase(prisma);
  await prisma.$disconnect();
  console.log("✓ reseeded the real Postgres database with mock-store's deterministic fixtures");

  await client.connect(transport);

  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name).sort();
  assert.deepEqual(toolNames, [
    "check_consent_status",
    "create_consent_record",
    "create_dsr_request",
    "get_compliance_snapshot",
    "list_open_dsr_requests",
    "report_breach_event",
    "revoke_consent",
    "verify_ledger_integrity",
  ]);
  console.log(`✓ all 8 tools registered: ${toolNames.join(", ")}`);

  // check_consent_status — known seeded pair
  const status = await client.callTool({
    name: "check_consent_status",
    arguments: { principal_id: "principal-1", purpose_id: "purpose-2" },
  });
  const statusData = textOf(status) as { id: string; status: string };
  assert.equal(statusData.id, "consent-1");
  assert.equal(statusData.status, "granted");
  console.log("✓ check_consent_status returns the seeded artifact");

  // list_open_dsr_requests — overdue_only
  const overdue = await client.callTool({
    name: "list_open_dsr_requests",
    arguments: { overdue_only: true },
  });
  const overdueData = textOf(overdue) as Array<{ id: string }>;
  assert.equal(overdueData.length, 1);
  assert.equal(overdueData[0]?.id, "dsr-2");
  console.log("✓ list_open_dsr_requests(overdue_only: true) returns exactly dsr-2");

  // list_open_dsr_requests — all open (not resolved)
  const allOpen = await client.callTool({
    name: "list_open_dsr_requests",
    arguments: {},
  });
  const allOpenData = textOf(allOpen) as Array<{ id: string }>;
  // 4 unresolved: dsr-1..dsr-3 (fiduciary-1) + dsr-4 (fiduciary-2, Phase 8) —
  // mcp-server stays tenant-unscoped by design, so it sees both fiduciaries.
  assert.equal(allOpenData.length, 4);
  console.log("✓ list_open_dsr_requests() returns all 4 seeded (unresolved) requests across both fiduciaries");

  // create_consent_record
  const created = await client.callTool({
    name: "create_consent_record",
    arguments: {
      principal_id: "principal-6",
      purpose_id: "purpose-2",
      notice_version: "v1.3",
      language: "en",
    },
  });
  const createdData = textOf(created) as { id: string; status: string };
  assert.equal(createdData.status, "granted");
  console.log(`✓ create_consent_record created ${createdData.id}`);

  // create_consent_record against a legitimate_use purpose (purpose-3) should come back
  // as a tool error, not a crash — consent isn't a valid basis for that purpose.
  const createAgainstLegitimateUse = await client.callTool({
    name: "create_consent_record",
    arguments: {
      principal_id: "principal-6",
      purpose_id: "purpose-3",
      notice_version: "v1.3",
      language: "en",
    },
  });
  assert.equal(createAgainstLegitimateUse.isError, true);
  console.log("✓ create_consent_record against a legitimate_use purpose returns isError instead of throwing");

  // revoke_consent
  const revoked = await client.callTool({
    name: "revoke_consent",
    arguments: { consent_id: createdData.id, reason: "smoke-test revoke" },
  });
  const revokedData = textOf(revoked) as { status: string; withdrawnAt: string };
  assert.equal(revokedData.status, "withdrawn");
  assert.ok(revokedData.withdrawnAt);
  console.log("✓ revoke_consent transitioned it to withdrawn");

  // revoke_consent on an already-withdrawn artifact should come back as a tool error, not a crash
  const revokeAgain = await client.callTool({
    name: "revoke_consent",
    arguments: { consent_id: createdData.id, reason: "double revoke" },
  });
  assert.equal(revokeAgain.isError, true);
  console.log("✓ revoking an already-withdrawn artifact returns isError instead of throwing");

  // create_dsr_request
  const dsr = await client.callTool({
    name: "create_dsr_request",
    arguments: { principal_id: "principal-1", type: "access" },
  });
  const dsrData = textOf(dsr) as { id: string; status: string; type: string };
  assert.equal(dsrData.status, "open");
  assert.equal(dsrData.type, "access");
  console.log(`✓ create_dsr_request created ${dsrData.id}`);

  // report_breach_event — low severity: logged, no notice drafting
  const lowBreach = await client.callTool({
    name: "report_breach_event",
    arguments: {
      description: "Smoke-test low-severity breach",
      detected_at: new Date().toISOString(),
      dpb_notify_due_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      severity: "low",
    },
  });
  const lowBreachData = textOf(lowBreach) as { id: string; noticeDrafting: boolean };
  assert.equal(lowBreachData.noticeDrafting, false);
  console.log(`✓ report_breach_event(severity: low) logged ${lowBreachData.id} without triggering notice drafting`);

  // report_breach_event — high severity: logged AND enqueues onto the breach-notice-draft
  // queue (BREACH_NOTICE_DRAFT_QUEUE) for jobs/'s worker to pick up and stage a draft.
  const highBreach = await client.callTool({
    name: "report_breach_event",
    arguments: {
      description: "Smoke-test high-severity breach",
      detected_at: new Date().toISOString(),
      dpb_notify_due_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      severity: "high",
      affected_purpose_ids: ["purpose-1"],
    },
  });
  const highBreachData = textOf(highBreach) as { id: string; noticeDrafting: boolean };
  assert.equal(highBreachData.noticeDrafting, true);
  console.log(`✓ report_breach_event(severity: high) logged ${highBreachData.id} and triggered notice drafting`);

  // get_compliance_snapshot
  const snapshot = await client.callTool({
    name: "get_compliance_snapshot",
    arguments: { from: "2026-01-01T00:00:00.000Z", to: "2026-12-31T00:00:00.000Z" },
  });
  const snapshotData = textOf(snapshot) as { consentsGranted: number; dsrOverdue: number; breachesLogged: number };
  assert.ok(snapshotData.consentsGranted > 0);
  assert.ok(snapshotData.dsrOverdue >= 1);
  // 2 seeded (breach-1, breach-2 — Phase 8 added a second fiduciary's
  // breach) + the 2 report_breach_event calls just made above. mcp-server
  // stays tenant-unscoped by design, so this aggregates across both.
  assert.equal(snapshotData.breachesLogged, 4);
  console.log("✓ get_compliance_snapshot aggregates consents, DSRs, and breaches");

  // get_compliance_snapshot — bad input surfaces as a tool error
  const badSnapshot = await client.callTool({
    name: "get_compliance_snapshot",
    arguments: { from: "not-a-date", to: "2026-12-31T00:00:00.000Z" },
  });
  assert.equal(badSnapshot.isError, true);
  console.log("✓ get_compliance_snapshot rejects an invalid date as isError, not a crash");

  // verify_ledger_integrity — should be intact after everything above, including
  // the create_consent_record/revoke_consent/create_dsr_request writes just made
  const integrity = await client.callTool({
    name: "verify_ledger_integrity",
    arguments: {},
  });
  const integrityData = textOf(integrity) as { intact: boolean; entriesChecked: number };
  assert.equal(integrityData.intact, true);
  assert.ok(integrityData.entriesChecked >= 21 + 5); // 21 seeded + at least the 5 writes made above (3 consent/dsr + 2 breach logs)
  console.log(`✓ verify_ledger_integrity reports the chain intact (${integrityData.entriesChecked} entries)`);

  // verify_ledger_integrity — malformed date range surfaces as a tool error
  const badIntegrity = await client.callTool({
    name: "verify_ledger_integrity",
    arguments: { from_date: "2026-01-01T00:00:00.000Z" }, // missing to_date
  });
  assert.equal(badIntegrity.isError, true);
  console.log("✓ verify_ledger_integrity rejects a one-sided date range as isError, not a crash");

  await client.close();
  console.log("\nAll smoke tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
