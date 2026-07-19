# Consent Vault Manager

A Data Fiduciary-side consent lifecycle system under India's DPDP Act 2023 —
vault, automations, and MCP orchestration. Building mock-first per the spec:
the repository interfaces are fixed early so the MCP server and job workers
never change when the real Postgres backend replaces the mock store.

This project lives at `projects/consent-vault-manager/` in this repo,
alongside the unrelated LexEdu app (`backend/`, `frontend/`) — the two are
independent projects sharing a repo, not a monorepo (yet).

## Status: Phase 0 — mock data layer

Done:
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

Not built yet (later phases per the spec): MCP server (Phase 1), automation
jobs (Phase 2–3), NestJS + Postgres backend (Phase 4), ledger hash-chaining
(Phase 5), React dashboard (Phase 6), breach notice drafting (Phase 7).

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
cd projects/consent-vault-manager
npm install
npm run demo        # prints seeded data + a create/revoke round trip
npm test            # node:test suite over the mock store
npm run typecheck   # tsc --noEmit
```

## Next step

Phase 1: build `mcp-server/`, wired to `mock-store/` instead of an API,
exposing `create_consent_record`, `revoke_consent`, `check_consent_status`,
`list_open_dsr_requests`, `create_dsr_request`, and `get_compliance_snapshot`
as MCP tools, with a `.mcp.json` registering it as a local stdio server.
