# Consent Vault Manager

A Data Fiduciary-side consent lifecycle system under India's DPDP Act 2023 —
vault, automations, and MCP orchestration. Building mock-first per the spec:
the repository interfaces are fixed early so the MCP server and job workers
never change when the real Postgres backend replaces the mock store.

This project lives at `projects/consent-vault-manager/` in this repo,
alongside the unrelated LexEdu app (`backend/`, `frontend/`) — the two are
independent projects sharing a repo, not a monorepo (yet).

## Status: Phase 3 — real Gmail/Calendar notifications, human-confirmed

Done — Phase 0 (mock data layer):
- `mock-store/types.ts` — domain model (`DataPrincipal`, `DataFiduciary`,
  `Purpose`, `ConsentArtifact`, `ConsentLedgerEntry`, `DSRRequest`,
  `BreachEvent`, plus `Processor`, added in Phase 2 — see below).
- `mock-store/repositories.ts` — `ConsentRepository`, `DSRRepository`,
  `LedgerRepository` interfaces a future Postgres implementation must
  satisfy unchanged.
- `mock-store/store.ts` — `InMemoryConsentVaultStore`, implementing all
  three interfaces over in-memory `Map`s.
- `mock-store/seed.ts` — deterministic fake data: 8 `DataPrincipal`s, 4
  `Purpose`s, 12 `ConsentArtifact`s (granted/withdrawn/expired mix, including
  one deliberately stale granted artifact for Phase 2 to sweep), 3
  `DSRRequest`s (one overdue), 1 `BreachEvent`, 6 `Processor`s, plus matching
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

Done — Phase 2 (job workers):
- `jobs/src/index.ts` — a long-running worker process holding **one**
  `InMemoryConsentVaultStore` for its lifetime (recreating the store per job
  run would reset state to the seed every tick, defeating the point).
  Registers a BullMQ repeatable job on the `expiry-sweep` queue
  (`EXPIRY_SWEEP_INTERVAL_MS`, default 2 minutes for the demo — set the env
  var to `86400000` for daily) and starts two `Worker`s: one processes
  `expiry-sweep` jobs, the other processes `withdrawal-cascade` jobs.
- `jobs/src/expirySweep.ts` — `runExpirySweep(store, stagePendingAction)`:
  finds `granted` `ConsentArtifact`s whose `expiresAt` has passed, flips
  each to `expired` via `store.markExpired` (which itself writes the
  `ConsentLedgerEntry` — see Phase 0's design), and drafts a renewal email.
- `jobs/src/withdrawalCascade.ts` — `runWithdrawalCascade(store, {
  consentId }, stagePendingAction)`: looks up the withdrawn artifact's
  purpose, finds every `active` `Processor` tied to that purpose, marks each
  `purge_pending` via `store.markProcessorForPurge` (writes a
  `processor_purge_flagged` ledger entry per processor), and drafts both a
  purge-notice email and a 7-day follow-up calendar event per processor.
- `jobs/scripts/fire-withdrawal-event.ts` — `npm run fire:withdrawal --
  <consentId>` enqueues a mock "consent revoked" event onto the
  `withdrawal-cascade` queue over Redis. It only touches Redis, not the
  store directly — store state lives inside the running `npm start`
  worker process, so this only works while that's running.
- Both job functions are pure `(store, ...) => Promise<result>` functions,
  unit-tested with `node:test` and zero Redis dependency
  (`jobs/tests/*.test.ts`).

Done — Phase 3 (real Gmail/Calendar notifications, human-confirmed):
- **Why jobs don't call Gmail/Calendar MCP directly.** Those connectors are
  only reachable from an interactive Claude session (they're tied to the
  account's live MCP connections) — a headless `jobs/` Node process has no
  credentials to call them with, and shouldn't be handed any. So instead of
  sending, a job **drafts** the content and **stages** it; only a human (via
  Claude Code, which does have live Gmail/Calendar access) can actually
  create the real artifact and confirm it happened.
- `jobs/src/pendingActions.ts` — `PendingEmailAction` / `PendingCalendarAction`
  types for drafted-but-unconfirmed content, plus `ConfirmedNotificationJobData`
  for the confirmation round trip.
- Both `runExpirySweep` and `runWithdrawalCascade` now take a
  `stagePendingAction` callback (real implementation in `index.ts` enqueues
  onto the `pending-notifications` queue; unit tests inject an in-memory
  collector instead — no interface change needed, just an added parameter).
- `jobs/scripts/list-pending.ts` (`npm run list-pending`) — read-only,
  lists every staged draft waiting on confirmation, straight from Redis.
- `jobs/scripts/confirm-notification.ts` (`npm run confirm -- <pendingJobId>
  --gmail-draft-id=<id>` or `--calendar-event-id=<id>`) — the manual
  confirmation gate. Run this **after** the real Gmail draft / Calendar
  event has actually been created; it removes the item from the pending
  inbox and enqueues onto `notification-confirmed`, which the **same**
  long-running `npm start` worker process picks up (so it writes to the
  same store instance the original job mutated) via
  `jobs/src/confirmNotification.ts`'s `recordConfirmedNotification`, adding
  a `renewal_email_drafted` / `purge_notice_email_drafted` /
  `purge_followup_event_scheduled` ledger entry with the real draft/event id,
  recipient, and message type.
- Gmail's MCP connector here only exposes `create_draft` — there's no send
  tool. That's actually a good fit: the "real" action available is creating
  a draft that sits in Drafts until a human sends it, which is an even
  stronger confirmation gate than the one this system adds on top. Calendar's
  `create_event` does create a live event immediately, so the pending/confirm
  gate is the only thing standing between a draft and a real calendar entry.
- `jobs/scripts/smoke-test.ts` covers the whole loop against real Redis:
  spawns the worker, triggers an expiry-sweep tick and a withdrawal cascade,
  confirms every staged item with **fake** draft/event ids (it doesn't touch
  real Gmail/Calendar), and asserts on the resulting `[confirmed]` log lines.
  A full live run — real Gmail draft + real Calendar event, confirmed with
  their real ids — was also verified by hand against the account this
  session is running as.

Not built yet (later phases per the spec): NestJS + Postgres backend
(Phase 4), ledger hash-chaining (Phase 5), React dashboard (Phase 6), breach
notice drafting (Phase 7).

### Design decisions made without a spec answer

The spec's domain model lists 7 entities but only 3 repositories. This
groups them as:
- `ConsentRepository` — `DataFiduciary`, `DataPrincipal`, `Purpose`,
  `ConsentArtifact`, `Processor` (added in Phase 2, see below)
- `DSRRepository` — `DSRRequest`
- `LedgerRepository` — `ConsentLedgerEntry`, `BreachEvent` (both
  audit/compliance history; `get_compliance_snapshot` needs both)

If you intended a different split, it's a small refactor — the entity/method
groupings, not the entities or method signatures themselves, would change.

**`Processor` entity (Phase 2 addition).** The spec's withdrawal cascade
automation (section 4, #2) says to "walk any downstream `processor` records
tied to that purpose and mark them for purge/notify" — but `Processor` isn't
in section 2's domain model table, so Phase 0/1 never modeled it. Rather than
fake the cascade against nothing (which would violate "every job action must
go through LedgerRepository, not just a console.log"), Phase 2 adds a minimal
`Processor` entity (`id`, `name`, `purposeId`, `status`) to `types.ts`, two
methods on `ConsentRepository` (`listProcessors`, `markProcessorForPurge`),
and 6 seeded processors across the 4 purposes. If you had a different shape
in mind (e.g. a separate `ProcessorRepository`, or fields like a processor's
own DPO contact), it's additive to change — nothing else depends on the
current shape beyond `jobs/src/withdrawalCascade.ts`.

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

# jobs — its own package too; needs Redis running locally
cd ../jobs
npm install
npm run typecheck
npm test            # node:test over runExpirySweep/runWithdrawalCascade, no Redis needed
```

`jobs/` needs a real Redis for anything BullMQ (the unit tests above don't
touch it, but `start`/`smoke-test`/`fire:withdrawal` do):

```bash
redis-server --daemonize yes          # or: docker run -d -p 6379:6379 redis
```

Then, from `jobs/`:

```bash
npm run smoke-test   # spawns the worker, drives it over real Redis, asserts on its logs (fake ids only)

# or run it live in two terminals:
npm start                              # terminal 1 — long-running worker
npm run fire:withdrawal -- consent-4   # terminal 2 — fires a mock withdrawal event
```

`consent-4` and `consent-6` are seeded as already-withdrawn artifacts whose
purposes (`purpose-4`/analytics, `purpose-1`/marketing) have active
processors, so either makes a good manual demo target. The expiry sweep
needs no manual trigger — `consent-12` is seeded deliberately stale, so the
very first sweep tick expires it for you.

With the worker running, drafted notifications show up on the
`pending-notifications` queue instead of being sent — review and confirm
them from a second terminal:

```bash
npm run list-pending                                          # see every drafted email/event awaiting confirmation
# ... create the real Gmail draft / Calendar event via Claude Code ...
npm run confirm -- <pendingJobId> --gmail-draft-id=<id>       # for a drafted email
npm run confirm -- <pendingJobId> --calendar-event-id=<id>    # for a drafted calendar event
```

`confirm-notification.ts` has no Gmail/Calendar credentials itself — it only
records that a human (via Claude Code's live MCP tool access) already
created the real draft/event. Skipping straight to `confirm` without
actually creating anything just puts a fabricated id on the ledger, so don't.

To register the MCP server with Claude Code from the repo root:

```bash
claude mcp add consent-vault -- projects/consent-vault-manager/mcp-server/node_modules/.bin/tsx projects/consent-vault-manager/mcp-server/src/index.ts
```

or just rely on the committed `.mcp.json` at the repo root, which Claude Code
picks up automatically for anyone working in this repo (after they've run
`npm install` inside `mcp-server/`). Try asking it things like "which DSRs
are overdue" or "check consent status for principal-1 on purpose-2" once
it's connected.

## Next step

Phase 4: build the real NestJS + Postgres backend, implementing the exact
same `ConsentRepository` / `DSRRepository` / `LedgerRepository` interfaces
from Phase 0 — nothing in `mcp-server/` or `jobs/` should need to change,
only the implementation swapped in for `createSeededStore()`.
