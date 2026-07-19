# Consent Vault Manager

A Data Fiduciary-side consent lifecycle system under India's DPDP Act 2023 —
vault, automations, and MCP orchestration. Building mock-first per the spec:
the repository interfaces are fixed early so the MCP server and job workers
never change when the real Postgres backend replaces the mock store.

This project lives at `projects/consent-vault-manager/` in this repo,
alongside the unrelated LexEdu app (`backend/`, `frontend/`) — the two are
independent projects sharing a repo, not a monorepo (yet).

## Status: Phase 4 — real NestJS + Postgres backend (not wired in yet)

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

Done — Phase 4 (NestJS + Postgres backend, satisfying the same interfaces):
- `apps/api/` — its own npm package, own `node_modules`. `docker-compose.yml`
  at the **repo root** spins up local Postgres 16 (`consent_vault` user/db,
  port 5432); `apps/api/.env.example` has the matching `DATABASE_URL`.
- `apps/api/prisma/schema.prisma` — the full domain model from section 2
  (`DataFiduciary`, `DataPrincipal`, `Purpose`, `ConsentArtifact`,
  `ConsentLedgerEntry`, `DSRRequest`, `BreachEvent`) plus `Processor` (the
  Phase 2 addition, mirrored here for interface parity), migrated via
  `prisma migrate dev`. `ConsentLedgerEntry.sequence` is a real Postgres
  `SERIAL` — same append-order guarantee the mock's array index gave, still
  no `hash`/`prevHash` (Phase 5, per the spec).
- `apps/api/src/consent-vault/prisma-consent.repository.ts`,
  `prisma-dsr.repository.ts`, `prisma-ledger.repository.ts` — three
  `@Injectable()` NestJS providers, one per mock-store interface, each
  implementing `ConsentRepository` / `DSRRepository` / `LedgerRepository`
  **exactly as imported from `mock-store/repositories.ts`** — same method
  signatures, same async contracts, same pagination shape, same thrown-error
  messages (e.g. `Cannot revoke consent artifact "..." from status "..."`),
  same non-obvious behavior quirks (`getComplianceSnapshot`'s `dsrOpen` /
  `dsrOverdue` intentionally ignore the date range, exactly like the mock).
  `PrismaConsentRepository`/`PrismaDSRRepository` take `PrismaLedgerRepository`
  as a constructor-injected dependency for their self-logging calls, mirroring
  how the mock's single class self-logged via its own `appendEntry`.
- These imports are **type-only** (`import type { ... } from
  "../../../../mock-store/repositories"`) — apps/api never depends on
  mock-store's runtime (no `InMemoryConsentVaultStore`, no
  `createSeededStore`), only its type contracts, so the CJS-compiled Nest
  app and the ESM-authored mock-store package never collide at runtime.
  `apps/api/src/consent-vault/mappers.ts` converts Prisma's generated row
  types to the mock-store domain types (mostly pass-through; `null` →
  `undefined` for optional fields, and casting the untyped `Json` `detail`
  column to `Record<string, unknown>`).
- Not wrapped in `$transaction`: each mutation does its read/write against
  Postgres and then calls `PrismaLedgerRepository.appendEntry` as a second,
  separate statement — same sequencing the mock does, just without the
  implicit atomicity JS's single-threadedness gave it there. Fine for this
  phase's demo/test scope; production hardening would wrap each in
  `prisma.$transaction`.
- Basic CRUD endpoints for principals, purposes, and consent artifacts
  (`PrincipalsController`, `PurposesController`, `ConsentArtifactsController`)
  — `GET`/`GET :id`/`POST` for all three, plus `POST
  /consent-artifacts/:id/revoke` as a domain action (mirroring the
  `revoke_consent` MCP tool's shape) rather than a generic `PATCH`. No DSR/
  Ledger/Breach/Processor endpoints yet — out of this phase's explicit scope.
- `apps/api/prisma/seed-database.ts` calls mock-store's own
  `createSeedData()` directly and inserts it via Prisma — the Postgres
  seed reuses the exact same deterministic fixtures as the mock (single
  source of truth), rather than a second hand-authored copy that could
  drift. `npm run prisma:seed` (CLI) and the Jest test suite's
  `resetDatabase()` (truncate + reseed before each test) both call it.
- `apps/api/test/*.spec.ts` — 13 Jest tests mirroring mock-store's own test
  coverage (seed counts, `check_consent_status` lookup, create+revoke round
  trip with ledger entries, double-revoke rejection, 30-day DSR SLA,
  processor purge, compliance snapshot), run with `--runInBand` since all
  three spec files truncate/reseed the **same** real local Postgres
  database and would race each other in parallel workers.

Not wired in yet: `mcp-server/` and `jobs/` still run entirely against
`mock-store/`, per the spec — this phase only had to prove the real backend
works against its own test suite. Wiring is Phase 5.

Not built yet (later phases per the spec): ledger hash-chaining (Phase 5),
React dashboard (Phase 6), breach notice drafting (Phase 7).

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

**`createPrincipal`/`createPurpose` (Phase 4 addition).** "Basic CRUD
endpoints for principals, purposes, and consent artifacts" implies a create
path for all three, but `ConsentRepository` only ever had reads
(`listPrincipals`/`findPrincipalById`, `listPurposes`/`findPurposeById`) —
Phase 0 treated principals/purposes as reference data, never
API-created. Added both methods to the interface *and* implemented them in
`InMemoryConsentVaultStore` (Phase 0) in the same commit, so the mock stays
in sync rather than silently falling out of parity with what Phase 4 needs.

**Three separate repository classes, not one combined class.** The mock's
single `InMemoryConsentVaultStore` implements all three interfaces at once
(simple since it's all in-memory Maps in one object). The Prisma-backed
version instead has three separate `@Injectable()` providers — more
idiomatic NestJS DI, and matches "Implement ConsentRepository, DSRRepository,
and LedgerRepository" reading as three distinct things. `getComplianceSnapshot`
(on `LedgerRepository`) needs consent/DSR data, but rather than depending on
the other two repositories (risking a circular dependency back from
`PrismaConsentRepository`/`PrismaDSRRepository`, which depend on
`PrismaLedgerRepository` for self-logging), it just queries those Prisma
tables directly — all three are facades over the same Postgres connection
via `PrismaService`, so this isn't a real encapsulation break. One
consequence for Phase 5: MCP-server/jobs will hold three separate service
references instead of mock-store's one combined store object — same method
calls, different container shape. Flagging it now since Phase 4 was
explicitly scoped to not wire that up yet.

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

### apps/api — NestJS + Postgres

```bash
# from the repo root
docker compose up -d          # local Postgres 16 on :5432
# (this sandbox's Docker daemon couldn't start, so Phase 4 was verified
# against a natively-installed Postgres 16 with matching credentials
# instead — docker-compose.yml is what you'll actually use)

cd projects/consent-vault-manager/apps/api
npm install
cp .env.example .env          # adjust if you changed the compose credentials
npx prisma migrate dev        # applies prisma/migrations/, generates the client
npm run prisma:seed           # loads mock-store's exact seed data via Prisma
npm test                      # 13 Jest tests against the real database (--runInBand)
npm run typecheck

npm start                     # nest build && node dist/apps/api/src/main.js
```

Try it:

```bash
curl http://localhost:3000/principals/principal-1
curl "http://localhost:3000/consent-artifacts?principalId=principal-1&purposeId=purpose-2"
curl -X POST http://localhost:3000/consent-artifacts \
  -H "Content-Type: application/json" \
  -d '{"principalId":"principal-1","purposeId":"purpose-1","noticeVersion":"v2.0","language":"en"}'
```

**Why `npm start` is `nest build && node dist/apps/api/src/main.js`, not
`nest start`.** `apps/api/src/**/*.ts` type-only-imports from
`../../mock-store` (outside apps/api's own directory), and TypeScript
computes its output directory structure from the common root of every file
it compiles — since `apps/api/tsconfig.json` doesn't pin `rootDir`, pulling
in `../../mock-store` pushes that common root up, so `nest build` emits
`dist/apps/api/src/main.js` (mirroring the wider tree) rather than
`dist/main.js`. Nest CLI's own `start`/`start:dev` runners hardcode the
latter path and fail; `npm start` here just points at where the file
actually lands. (Enabling Nest's webpack bundling mode would sidestep this
by bundling everything into one `dist/main.js` regardless of source
location, but Prisma's native query-engine binary and webpack bundling are
a known friction point, so build+run was the safer choice for this phase.)

## Next step

Phase 5 — cut over: point `mcp-server/` and `jobs/` at the real
`PrismaConsentRepository`/`PrismaDSRRepository`/`PrismaLedgerRepository`
instead of `mock-store/`'s `createSeededStore()`, and add the hash-chained
ledger (append-only, hash of the previous row) — held until now because,
per the spec, "a fake hash chain proves nothing."
