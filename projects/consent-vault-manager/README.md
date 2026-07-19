# Consent Vault Manager

A Data Fiduciary-side consent lifecycle system under India's DPDP Act 2023 —
vault, automations, and MCP orchestration. Building mock-first per the spec:
the repository interfaces are fixed early so the MCP server and job workers
never change when the real Postgres backend replaces the mock store.

This project lives at `projects/consent-vault-manager/` in this repo,
alongside the unrelated LexEdu app (`backend/`, `frontend/`) — the two are
independent projects sharing a repo, not a monorepo (yet).

## Status: Phase 1 — MCP server against the mock store

Done — Phase 0 (mock data layer):
- `mock-store/types.ts` — domain model (`DataPrincipal`, `DataFiduciary`,
  `Purpose`, `ConsentArtifact`, `ConsentLedgerEntry`, `DSRRequest`,
  `BreachEvent`).
- `mock-store/repositories.ts` — `ConsentRepository`, `DSRRepository`,
  `LedgerRepository` interfaces a future Postgres implementation must
  satisfy unchanged.
- `mock-store/store.ts` — `InMemoryConsentVaultStore`, implementing all
  three interfaces over in-memory `Map`s.
- `mock-store/seed.ts` — deterministic fake data: 8 `DataPrincipal`s, 4
  `Purpose`s, 11 `ConsentArtifact`s (granted/withdrawn/expired mix), 3
  `DSRRequest`s (one overdue), 1 `BreachEvent`, plus matching
  `ConsentLedgerEntry` rows for every seeded historical state change.

Done — Phase 1 (MCP server):
- `mcp-server/src/index.ts` — an `@modelcontextprotocol/sdk` stdio server
  exposing the 6 tools from spec section 5a: `create_consent_record`,
  `revoke_consent`, `check_consent_status`, `list_open_dsr_requests`,
  `create_dsr_request`, `get_compliance_snapshot`. Wired directly to a
  seeded `InMemoryConsentVaultStore` — no API, no database yet. State resets
  every time the server process restarts.
- Write tools (`create_consent_record`, `revoke_consent`,
  `create_dsr_request`) are marked `readOnlyHint: false` in their MCP
  annotations (`revoke_consent` also `destructiveHint: true`) so a calling
  client knows to confirm before invoking them, per the spec's "keep
  write-actions behind confirmation prompts" note. Tool-level failures
  (unknown id, invalid date, double-revoke) come back as `isError: true`
  results rather than thrown exceptions/crashes.
- `.mcp.json` at the repo root registers it as a local stdio server —
  `command`/`args` point at the project's own `node_modules/.bin/tsx`
  running `mcp-server/src/index.ts` directly, so no build step is required
  in dev.
- `mcp-server/scripts/smoke-test.ts` — spawns the server with the exact
  command/args/cwd from `.mcp.json`, connects a real `Client` over
  `StdioClientTransport`, and drives all 6 tools (including two
  error-path cases) against the seeded data. Not a typecheck — an actual
  client/server round trip.

Not built yet (later phases per the spec): automation jobs (Phase 2–3),
NestJS + Postgres backend (Phase 4), ledger hash-chaining (Phase 5), React
dashboard (Phase 6), breach notice drafting (Phase 7).

### Design decision made without a spec answer

The spec's domain model lists 7 entities but only 3 repositories. This
groups them as:
- `ConsentRepository` — `DataFiduciary`, `DataPrincipal`, `Purpose`,
  `ConsentArtifact`
- `DSRRepository` — `DSRRequest`
- `LedgerRepository` — `ConsentLedgerEntry`, `BreachEvent` (both
  audit/compliance history; `get_compliance_snapshot` needs both)

If you intended a different split, it's a small refactor — the entity/method
groupings, not the entities or method signatures themselves, would change.

### Hash-chaining is deliberately absent

`ConsentLedgerEntry` has no `hash`/`prevHash` fields yet. The spec holds
hash-chaining until Phase 5 against the real ledger table ("a fake hash
chain proves nothing"), so Phase 0 keeps the type honest to that: an
append-only log ordered by `sequence`, nothing more.

## Running it

```bash
# mock-store — demo, tests, typecheck
cd projects/consent-vault-manager
npm install
npm run demo        # prints seeded data + a create/revoke round trip
npm test            # node:test suite over the mock store
npm run typecheck   # tsc --noEmit

# mcp-server — its own package, its own node_modules
cd mcp-server
npm install
npm run typecheck
npm run smoke-test  # real client/server round trip over all 6 tools
```

To register the server with Claude Code from the repo root:

```bash
claude mcp add consent-vault -- projects/consent-vault-manager/mcp-server/node_modules/.bin/tsx projects/consent-vault-manager/mcp-server/src/index.ts
```

or just rely on the committed `.mcp.json` at the repo root, which Claude Code
picks up automatically for anyone working in this repo (after they've run
`npm install` inside `mcp-server/`). Try asking it things like "which DSRs
are overdue" or "check consent status for principal-1 on purpose-2" once
it's connected.

## Next step

Phase 2: wire BullMQ (or `setInterval` for the demo) to run the expiry sweep
and withdrawal cascade jobs against the mock store, logging what *would*
happen — no real Gmail send yet, just console output.
