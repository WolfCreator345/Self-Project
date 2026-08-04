# Consent Vault Manager

A Data Fiduciary-side consent lifecycle system under India's DPDP Act 2023 —
vault, automations, and MCP orchestration. Building mock-first per the spec:
the repository interfaces are fixed early so the MCP server and job workers
never change when the real Postgres backend replaces the mock store.

This project lives at `projects/consent-vault-manager/` in this repo,
alongside the unrelated LexEdu app (`backend/`, `frontend/`) — the two are
independent projects sharing a repo, not a monorepo (yet).

## Status: Phase 7 — breach notices, DSR SLA escalation, weekly reports

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
  `SERIAL` — same append-order guarantee the mock's array index gave.
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

Done — Phase 5 (hash-chained ledger, cutover, `verify_ledger_integrity`):
- **Hash chain.** `ConsentLedgerEntry` gained `previousHash`/`hash`:
  `hash = SHA-256(previousHash + canonicalStringify({id, sequence, entryType,
  refId, principalId, detail, recordedAt}))`, the first entry chaining from
  `LEDGER_GENESIS_HASH` (64 zero chars). `canonicalStringify` recursively
  sorts object keys before hashing — without it, re-verifying after a
  round trip through Postgres's `jsonb` column could fail on genuinely
  untampered data, since key order isn't guaranteed to survive that trip.
  Implemented in `mock-store/hashChain.ts` and, **deliberately duplicated**
  (not imported) in `apps/api/src/consent-vault/hash-chain.ts` — apps/api's
  compiled CommonJS runtime can't reach into mock-store's ESM source the
  way `mcp-server`/`jobs` (run via `tsx`) can. Kept in sync via golden-vector
  tests in both packages (`tests/store.test.ts`, `test/hash-chain.spec.ts`)
  asserting byte-identical output for the same fixture input.
- **Schema migration, expand/backfill/contract.** `previousHash`/`hash`
  landed as nullable columns first (a migration against a table that
  already had 21 seeded rows from Phase 4 would otherwise fail outright),
  then `prisma/backfill-ledger-hash-chain.ts` computed the chain
  retroactively for those pre-existing rows (in `sequence` order, not
  `recordedAt` — see below), then a second migration tightened both
  columns to `NOT NULL`. `apps/api/src/consent-vault/backfill-hash-chain.ts`
  holds the actual backfill logic — idempotent and resumable, using a
  `PENDING_HASH_SENTINEL` (`""`) rather than `null` to mark "not chained
  yet" once the columns became `NOT NULL` (real hashes and
  `LEDGER_GENESIS_HASH` are always 64 hex chars, so `""` is unambiguous).
- **A real bug the backfill design surfaced.** The first implementation had
  `seedDatabase()` reuse `previousHash`/`hash` values already computed by
  mock-store's own `createSeedData()` — which assumes `sequence` starts at
  1, true only the *first* time a database is ever seeded. Postgres's
  autoincrement counter doesn't reset just because `TRUNCATE`/`deleteMany()`
  wiped every row, so a re-seeded dev database (or this repo's own Jest
  suite, resetting fixtures between tests) got rows whose *real* `sequence`
  didn't match what the copied-over hash assumed — `verifyLedgerIntegrity`
  correctly reported the chain as broken, because it *was*. Fixed by having
  `seedDatabase()` insert with the pending sentinel and then call the same
  `backfillLedgerHashChain()` the standalone script uses, so the chain is
  always computed against whatever `sequence` Postgres actually assigned,
  never trusted from elsewhere. (This is exactly the kind of thing a hash
  chain is *for* — it caught a real seeding bug immediately, in testing,
  rather than silently accepting a corrupted-looking-valid ledger.)
- **`verify_ledger_integrity` (new MCP tool).** Added to `LedgerRepository`
  as `verifyLedgerIntegrity(dateRange?)`, backing the 7th MCP tool. Always
  walks the *entire* chain from genesis regardless of `from_date`/`to_date`
  — a link can't be trusted in isolation from what came before it — those
  params only narrow what counts toward `entriesChecked` in the report.
  Returns `{ intact, entriesChecked, firstBreak? }`, where `firstBreak`
  gives the sequence/id/reason (`hash_mismatch` vs `previous_hash_mismatch`)
  of the first broken link, if any.
- **Cutover.** `mcp-server/src/index.ts` and `jobs/src/index.ts` now import
  `createRealRepositories()` from
  `apps/api/src/consent-vault/create-real-repositories.ts` instead of
  mock-store's `createSeededStore()`. That function manually instantiates
  `PrismaService` + the three repository classes — no Nest DI container
  involved, which works because the classes don't actually need Nest's
  reflection-based injection to function (they just take dependencies as
  plain constructor arguments, exactly like apps/api's own Jest tests
  already did: `new PrismaConsentRepository(prisma, ledger)`).
  `@Injectable()` is a harmless no-op decorator outside a Nest container.
  Verified empirically, not just in theory, that `tsx` can load this
  NestJS-decorated source as a genuine cross-package *value* import (not
  type-only) and successfully query Postgres — see the commit history for
  the standalone probe that confirmed it before the real cutover.
- **Three repos, not one combined object.** mock-store's `createSeededStore()`
  returned one object satisfying all three interfaces; the real cutover
  gives `mcp-server`/`jobs` three separate variables (`consent`, `dsr`,
  `ledger`) instead. Tool/job handler bodies needed a small mechanical edit
  (`store.createConsentArtifact(...)` → `consent.createConsentArtifact(...)`,
  etc.) — tool *definitions* (name, description, schema, annotations)
  didn't change at all, per the brief.
- **`ConsentRepository`/`LedgerRepository`, not `InMemoryConsentVaultStore`.**
  `jobs/src/expirySweep.ts`, `withdrawalCascade.ts`, and
  `confirmNotification.ts` were typed to accept the concrete mock class —
  narrowed to the specific interface each actually uses
  (`ConsentRepository` for the first two, `LedgerRepository` for the third)
  so the same functions work against both mock-store's
  `InMemoryConsentVaultStore` (used by `jobs/tests/*.test.ts`, unchanged —
  see "mock-store stays" below) and apps/api's Prisma-backed classes (used
  by the live `jobs/src/index.ts` worker).
- **mock-store stays, and is now the test double.** Per the brief: rather
  than deleting it, mock-store is what `jobs/tests/*.test.ts` and
  `mock-store`'s own suite run against — fast, no live Postgres needed. It
  needed the real hash-chain algorithm too (not a stub), since these tests
  now exercise the same interface real callers use, including any future
  test of integrity-checking logic against mock data.
- **A Jest-specific fix.** `mock-store/store.ts`/`seed.ts` gained a genuine
  *runtime* (not type-only) dependency on `hashChain.ts` — ts-jest's default
  CommonJS resolution doesn't know NodeNext-style `./hashChain.js` should
  resolve to the sibling `.ts` file (tsx handles this automatically; ts-jest
  doesn't). Fixed with a `moduleNameMapper` in `apps/api/package.json`
  stripping `.js` from relative specifiers before ts-jest resolves them.

Done — Phase 6 (session auth, incremental `verify_ledger_integrity`, React dashboard):
- **Incremental ledger verification.** `LedgerRepository.verifyLedgerIntegrity`
  gained a second param, `verifyFullChain = false`, and now caches an
  in-memory `{ sequence, hash }` checkpoint (instance-level — both the Nest
  app and the manually-wired `mcp-server`/`jobs` process construct exactly
  one long-lived repository instance per process, so this is safe). By
  default, a call only re-walks entries *past* the cached checkpoint,
  treating the checkpoint's own hash as the `startingHash` for `verifyChain`
  — `hashChain.ts`'s `verifyChain` (both copies) gained that param too. If
  the cached checkpoint no longer matches a live row (e.g. the table was
  reseeded out-of-band since the last check), it **self-heals** to a full
  walk from genesis rather than silently trusting stale state — verified in
  both mock-store's tests (checkpoint object staying valid across in-memory
  mutation) and apps/api's (real self-heal after `resetDatabase()`, since
  Postgres's never-reused autoincrement `sequence` guarantees the old
  checkpoint can't match any row post-reseed). `verifyFullChain: true` skips
  the cache and always walks from genesis — the "deep verify" escape hatch.
  Live-verified against real Postgres: first call full-walks (22 entries),
  second call incrementally checks 0, forced-full-chain call re-walks all 22.
- **DSR `type` filter.** `ListDSRRequestsParams` gained `type?: DSRType`,
  implemented identically in `InMemoryConsentVaultStore` (a `.filter()`) and
  `PrismaDSRRepository` (another `AND.push(...)` entry, matching the existing
  pattern for `status`/`overdueOnly`).
- **Session auth (`apps/api/src/auth/`).** `express-session` with an
  in-memory `MemoryStore` — fine for this phase's single-admin, single-process
  scope (explicitly *not* production-safe: sessions vanish on restart and
  don't share state across instances; swapping in a Redis-backed store later
  wouldn't touch anything else). The one admin user is seeded via
  `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` (bcrypt) env vars, not a DB table —
  no multi-user/role model yet, per the brief. `SessionAuthGuard` is
  registered app-wide via `APP_GUARD`, so every dashboard-facing endpoint is
  protected by default; routes opt **out** individually with `@Public()`
  (only `/auth/login` and `/auth/logout` use it) rather than each controller
  having to remember to opt in. `GET /auth/me` is deliberately *not* public —
  an unauthenticated request never reaches its handler at all, the guard
  throws 401 first, which is exactly the "am I still logged in?" signal the
  dashboard's session context needs. `main.ts` also gained `app.enableCors({
  origin: CORS_ORIGIN, credentials: true })` — cookies require a specific
  origin, not a wildcard, once `credentials: true` is set.
- **New dashboard-facing endpoints.** `GET /consent-artifacts/:id/ledger`
  (calls `ledger.listEntries({ refId: id })` — no interface change needed,
  that method already existed); `GET /dsr-requests` (filters by
  `type`/`status`/`overdueOnly`, then sorts by `dueAt` ascending — sorted in
  the *controller*, not `listDSRRequests` itself, since changing that
  method's existing `createdAt`-ascending default order could break other
  callers, like the MCP tool and existing tests, that rely on it); `GET
  /compliance/snapshot` (defaults to the last 90 days if `from`/`to` aren't
  given); `GET /compliance/ledger-integrity` (wraps the incremental
  `verifyLedgerIntegrity`, `?verifyFullChain=true` forces a deep verify);
  `GET /compliance/breach-events` (the compliance snapshot's
  `breachesLogged` is just a count — the dashboard's actual breach *log*
  needed the real list, so this backs it via the already-existing
  `listBreachEvents`).
- **`apps/dashboard/`** — Vite + React 19 + TypeScript, `react-router-dom`
  for routing, `@tanstack/react-query` for data fetching (its
  `refetchInterval` option is the 30-second polling for the DSR queue and
  compliance views — `VITE_POLL_INTERVAL_MS`, default 30000). Talks to
  `apps/api`'s REST endpoints directly with `credentials: "include"` on every
  fetch, **not** the MCP server — MCP is for agent/chat access, the
  dashboard is a normal cookie-authenticated web client, per the brief.
  `AuthProvider` treats a failed `GET /auth/me` (401, not logged in) as
  normal query state, not an error to crash on; `RequireAuth` redirects to
  `/login` (preserving the attempted path) whenever `username` is null.
  Three views: `ConsentStatusView` (status/purpose filters; resolves
  `principalId`/`purposeId` against `/principals`/`/purposes` client-side for
  display since the list endpoint doesn't join them; clicking a row fetches
  and shows its ledger history below the table), `DSRQueueView`
  (type/status filters; overdue flag computed the same way the backend's
  `overdueOnly` filter and compliance snapshot's `dsrOverdue` count already
  do — `dueAt < now && status !== "resolved"` — rather than trusting a
  stored `status === "overdue"` literal, since new DSR requests are never
  automatically transitioned to that status as time passes; only the seed
  fixture happens to have one hardcoded that way), `ComplianceView` (snapshot
  stat tiles, the green/red ledger integrity badge with an incremental-vs-
  full-walk label, and the breach log table).
- **Domain types, not duplicated.** `apps/dashboard/src/lib/types.ts`
  type-only re-exports the plain-interface entities from
  `mock-store/types.ts` (erased entirely at build time, so it only needs
  `tsc`'s ability to find the `.ts` file, never mock-store's own ESM/NodeNext
  runtime resolution) — a dashboard-local duplicate would just drift.
  *Not* re-exporting from `mock-store/repositories.ts`, though:
  `LedgerIntegrityReport` there references `LedgerIntegrityBreak` from
  `hashChain.ts`, which has a **runtime** `node:crypto` import — fine under
  mock-store's own Node-targeted tsconfig, but the dashboard's
  browser-targeted one has no `"node"` types, so resolving that module
  fails. `ComplianceSnapshot`/`LedgerIntegrityReport` are small, stable
  response shapes duplicated directly instead. Also: mock-store's entity
  interfaces type dates as `Date`, accurate for the in-memory store but not
  for what arrives over JSON (`apps/api` serializes every `Date` as an ISO
  string) — a `Serialized<T>` mapped type produces `WireConsentArtifact`/
  `WireConsentLedgerEntry`/`WireDSRRequest`/`WireBreachEvent` aliases so the
  fetch layer's types match what's actually on the wire.
- **Verified live**, not just typechecked: booted the real `apps/api`
  server and the dashboard's Vite dev server together, then drove the whole
  app through a real Chromium browser (Playwright) — unauthenticated access
  redirects to `/login`; login sets the session cookie and lands on
  `/consents`; the consent table resolves principal/purpose names and a row
  click loads its real ledger history; the DSR queue sorts by `dueAt` and
  flags the seeded overdue request; the compliance view shows a green
  "INTACT" badge (`full chain walk, checked 22 entries`), correct stat
  tiles, and the real breach log entry; sign-out clears the session and a
  direct navigation to a protected route while logged out bounces back to
  `/login`.

Done — Phase 7 (breach notice drafting, DSR SLA escalation, weekly compliance report):
- **`BreachEvent.affectedPurposeIds`.** `severity` already existed (Phase 0/2)
  — the new field is `affectedPurposeIds: string[]`, added to `BreachEvent`,
  `CreateBreachEventInput` (optional, defaults to `[]`), `schema.prisma`
  (native Postgres `String[]`, migrated), and both repositories. Rather than
  storing a redundant principal list, "affected principals" is derived at
  draft time by querying granted `ConsentArtifact`s for these purposes —
  mirrors how the withdrawal cascade already derives affected processors
  from a purpose instead of storing them directly. `findBreachEventById` was
  also added to `LedgerRepository` (mock-store + Prisma), needed by the
  notice-drafting job to load the triggering event.
- **New MCP tool: `report_breach_event`.** Creates the `BreachEvent` via
  `ledger.createBreachEvent` (a real write, exactly like the other 7 write
  tools already do — mcp-server has held its own direct Postgres connection
  since the Phase 5 cutover, so this isn't a new architectural risk). If
  severity is `high`/`critical`, it *also* enqueues onto a new
  `breach-notice-draft` BullMQ queue — mcp-server gained a minimal `bullmq`
  producer dependency for this (it never consumes, only adds), the same
  "any process can produce, only jobs/'s worker process holds live
  repositories and actually stages a draft" split
  `fire-withdrawal-event.ts` already established. `verify_ledger_integrity`
  also picked up the `verify_full_chain` param and an updated description
  while this file was open — a real Phase 6 gap (the tool's docs still said
  "always verified in full" after the incremental-checkpoint change).
- **`jobs/src/breachNoticeDraft.ts`.** Consumed by a new worker in
  `index.ts`. Drafts a DPB notification email (template covering
  description, detection time, severity, affected purposes, and an
  approximate affected-principal count) and stages a calendar deadline for
  `breachEvent.dpbNotifyDueAt` — same draft-then-confirm pattern as Phase
  3's expiry sweep/withdrawal cascade, never auto-sends/creates. Defensively
  re-checks severity is `high`/`critical` even though the MCP tool already
  gates on it (matches the existing pattern of server-side re-validation,
  e.g. `revoke_consent`'s status check). Requires `DPB_NOTIFICATION_EMAIL`
  to be set — there's no real Data Protection Board contact address to
  default to, and silently defaulting to a real regulator's email would be
  a genuine problem, so this throws rather than guessing.
- **`jobs/src/dsrSlaEscalation.ts`.** A new repeatable job scanning every
  not-yet-resolved `DSRRequest` and staging an internal reminder (to
  `SELF_NOTIFICATION_EMAIL`, never the data principal) at T-7d and T-2d
  before `dueAt`. Unlike expiry/withdrawal, an SLA reminder doesn't change
  the DSRRequest's status, so there's no entity-state-change to piggyback
  dedup on — a `hasPendingOrSentEscalation(dsrRequestId, threshold)`
  callback does the deduping instead, checking both the still-pending Redis
  queue (kind `dsr_escalation_email`, matching `refId` + `threshold`) and
  confirmed ledger entries (`dsr_escalation_sent` with that `threshold` in
  `detail`) — without checking both, a demo-cadence tick would keep
  re-staging duplicate reminders for the same request every 2 minutes until
  a human got around to confirming the first one.
- **`jobs/src/weeklyComplianceReport.ts` + `jobs/src/pdfPrinter.ts`.** A new
  repeatable job snapshots the last 7 days via
  `ledger.getComplianceSnapshot` and renders it as a PDF with `pdfmake`,
  configured with only the 14 standard PDF fonts (Helvetica family) — no
  TTF files to embed or fetch, so this needs no headless browser and works
  fully offline, per the brief. (`pdfmake`'s Node build is CommonJS with
  Babel's `__esModule` interop; importing it as real ESM double-wraps the
  exports, so `pdfPrinter.ts` unwraps that once — verified empirically
  against the installed version before relying on it, documented inline in
  case a future `pdfmake` upgrade changes its build output shape.) The PDF
  travels inline as base64 in a new `PendingReportAction` (`weekly_report`
  kind) — small enough for a BullMQ job payload, and avoids needing a
  shared filesystem between the job process and whatever process later
  confirms it. Gmail's `create_draft` tool doesn't support attachments (its
  own tool description says so), so the email is a text summary only,
  never carrying the PDF itself.
- **Archival: local disk, not Google Drive.** The original design archived
  the PDF to Google Drive alongside the Gmail draft. Drive's `create_file`
  turned out to have a live regression — it fails with "User cannot add
  children to the specified folder" whenever `parentId` is given, and
  there's no confirmed move/rename operation on that connector to relocate
  a root-level file afterward — so archival was switched to local disk
  instead of working around a connector that doesn't support what's
  needed. Archival now happens automatically inside
  `recordConfirmedNotification` at confirm time, behind a small
  `ReportArchiver` interface (`store(pdf, filename): Promise<string>`) —
  local disk needs no live MCP session, unlike Gmail/Calendar/Drive, so
  unlike those it doesn't need a human-supplied id to confirm; the
  `weekly_report` kind now only requires `--gmail-draft-id`.
  `LocalFileReportArchiver` writes to `jobs/reports/` (git-ignored,
  resolved relative to the package so it's correct regardless of `npm
  start`'s cwd), and the ledger entry's `detail.reportLocation` records the
  real path written. Swapping in a working Drive-backed `ReportArchiver`
  once the connector issue is fixed upstream is a one-line change at its
  construction site in `index.ts` — nothing else depends on the storage
  mechanism. The PDF's filename changed from a date-range to a full
  generation timestamp (`compliance-report-<ISO-timestamp>.pdf`) so
  same-day demo-cadence runs can't silently overwrite an earlier archived
  file that a ledger entry still points at.
- **`list-pending.ts`** decodes a `weekly_report` item's base64 PDF and
  writes it to a local temp file (printing the path) so a human can review
  the actual report content before drafting the email — no longer an
  "upload this somewhere" step, since archival is automatic now.
- **Verified live.** Booted the real `apps/api` + `jobs` worker against
  real Postgres/Redis. `mcp-server`'s smoke test now covers
  `report_breach_event` at both a logged-only severity and a
  notice-triggering severity (8 tools total). All three automations were
  verified fully end-to-end with **real** artifacts: a real Gmail draft +
  real Calendar event for the DPB breach notice, two real Gmail drafts for
  the T-7d/T-2d SLA reminders, and a real Gmail draft for the weekly report
  — confirming the last one produced a real file on disk at
  `jobs/reports/compliance-report-<timestamp>.pdf`, with its exact path
  and byte count verified by querying the resulting ledger entry directly.
  Every confirmation was written to the ledger, re-checked afterward via
  `verify_ledger_integrity` (`intact: true`, full walk). This session's
  sandbox also had Postgres and Redis restart mid-verification (twice);
  Postgres data survived to disk as expected and the same real Gmail/
  Calendar ids were re-confirmed against freshly-restaged pending items
  with no loss of correctness — an unplanned but useful proof that Redis
  is correctly treated as disposable working state, not a source of truth.

**Enforced: consent can't be recorded against a `legitimate_use` purpose.**
`Purpose.lawfulBasis` (`"consent" | "legitimate_use"`, Phase 0) existed as a
label from the start, but `createConsentArtifact` never actually checked it
— nothing stopped a `ConsentArtifact` from being recorded against a purpose
that isn't consent-based, which is backwards from how the DPDP Act's basis-
of-processing distinction works (consent literally isn't the basis for a
legitimate_use purpose, so it shouldn't be recordable as one). Now enforced
in both `mock-store/store.ts` and
`apps/api/src/consent-vault/prisma-consent.repository.ts`, rejecting with
`Purpose "X" is processed under "legitimate_use" — consent cannot be
recorded as its basis.` This also surfaced two seeded artifacts
(`consent-5`, `consent-10`) that had been recorded against `purpose-3` (the
seed's one `legitimate_use` purpose, "Fraud prevention and security
monitoring") — reassigned to consent-basis purposes with their `expiresAt`
recomputed against the new purpose's retention period, so the seed data no
longer contradicts the rule it's meant to demonstrate.
`mcp-server`'s `create_consent_record` tool inherits the rejection for
free (it calls straight through to the repository) — its description and
smoke test were updated to document and exercise it, and it was verified
live against the real Postgres-backed MCP server: creating against a
consent-basis purpose succeeds, against `purpose-3` comes back `isError:
true` with the message above.

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

### Hash-chaining (Phase 5)

Held back from Phase 0 through Phase 4 deliberately — the spec's own framing
is "a fake hash chain proves nothing," and there was no real ledger table to
chain until Phase 4 built one. See the Phase 5 section above for the
algorithm, the expand/backfill/contract migration sequence, and a real bug
the backfill design caught along the way.

**`GET /compliance/breach-events` (Phase 6 addition).** The spec's
compliance dashboard asks for a "breach log," but `ComplianceSnapshot`
(the same shape `get_compliance_snapshot` returns) only has
`breachesLogged: number` — a count, not the entries themselves. Rather than
render just a number where the brief implies an actual list, added this
one small endpoint wrapping the already-existing `listBreachEvents`
repository method (no interface change needed). If a count-only breach
section was actually intended, this is a one-controller-method removal.

**Sorting `GET /dsr-requests` by `dueAt` in the controller, not the
repository.** `listDSRRequests` already had callers (the MCP tool,
existing tests) depending on its `createdAt`-ascending default order —
changing that default to satisfy the dashboard's "sorted by due_at
ascending" requirement risked silently changing behavior those callers
weren't asking for. Sorting the controller's response instead keeps the
repository's own contract untouched.

## Running it

`mcp-server/` and `jobs/` now run against the real backend (Phase 5
cutover), so **set up `apps/api` and its Postgres first** — everything else
depends on it.

### 1. mock-store — no dependencies, start here

```bash
cd projects/consent-vault-manager
npm install
npm run demo        # prints seeded data + a create/revoke round trip
npm test            # node:test suite over the mock store, incl. hash-chain tests
npm run typecheck   # tsc --noEmit
```

### 2. apps/api — NestJS + Postgres

```bash
# from the repo root
docker compose up -d          # local Postgres 16 on :5432
# (this sandbox's Docker daemon couldn't start, so Phase 4/5 were verified
# against a natively-installed Postgres 16 with matching credentials
# instead — docker-compose.yml is what you'll actually use)

cd projects/consent-vault-manager/apps/api
npm install
cp .env.example .env                    # adjust if you changed the compose credentials
npx prisma migrate dev                  # applies prisma/migrations/ (incl. the hash-chain columns), generates the client
npm run prisma:seed                     # loads mock-store's exact seed data via Prisma, hash-chained
npm run prisma:backfill-hash-chain      # no-op on a fresh seed (already chained) — for pre-Phase-5 data
npm test                                # 24 Jest tests against the real database (--runInBand)
npm run typecheck

npm start                     # nest build && node dist/apps/api/src/main.js
```

**Auth setup (Phase 6).** `.env.example` also has `SESSION_SECRET`,
`CORS_ORIGIN` (must match wherever `apps/dashboard`'s dev server runs, e.g.
`http://localhost:5173`), `ADMIN_USERNAME`, and `ADMIN_PASSWORD_HASH` —
generate the hash with:

```bash
node -e "console.log(require('bcrypt').hashSync('your-password', 10))"
```

Every endpoint except `POST /auth/login` and `POST /auth/logout` requires an
authenticated session cookie now:

```bash
curl -c cookies.txt -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

curl -b cookies.txt http://localhost:3000/principals/principal-1
curl -b cookies.txt "http://localhost:3000/consent-artifacts?principalId=principal-1&purposeId=purpose-2"
curl -b cookies.txt -X POST http://localhost:3000/consent-artifacts \
  -H "Content-Type: application/json" \
  -d '{"principalId":"principal-1","purposeId":"purpose-1","noticeVersion":"v2.0","language":"en"}'
curl -b cookies.txt "http://localhost:3000/compliance/ledger-integrity"
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

**Postgres credentials are picked up automatically, even from `mcp-server/`
and `jobs/`.** Prisma's generated client auto-loads `.env` from near where
it was generated (`apps/api/`), regardless of the calling process's own
directory — verified empirically before relying on it. Neither
`mcp-server/` nor `jobs/` need their own `.env` or `DATABASE_URL` exports.

### 3. mcp-server — its own package, its own node_modules

```bash
cd ../mcp-server   # projects/consent-vault-manager/mcp-server
npm install
npm run typecheck
npm run smoke-test  # reseeds Postgres, then a real client/server round trip over all 8 tools
```

Postgres data persists across server restarts (unlike the old ephemeral
mock store), so the smoke test reseeds the database itself first —
otherwise re-running it would accumulate extra DSR requests/consent
artifacts from the previous run and its count-based assertions would drift.

To register the MCP server with Claude Code from the repo root:

```bash
claude mcp add consent-vault -- projects/consent-vault-manager/mcp-server/node_modules/.bin/tsx projects/consent-vault-manager/mcp-server/src/index.ts
```

or just rely on the committed `.mcp.json` at the repo root, which Claude Code
picks up automatically for anyone working in this repo (after `npm install`
in both `mcp-server/` and `apps/api/`, and Postgres seeded). Try asking it
things like "which DSRs are overdue," "check consent status for principal-1
on purpose-2," "verify the ledger integrity," or "report a high-severity
breach affecting purpose-1" once it's connected. If you already had it
connected before pulling this phase, reconnect/restart — MCP tool lists are
fetched once per session and won't pick up `report_breach_event` or
`verify_ledger_integrity`'s new `verify_full_chain` param otherwise.

### 4. jobs — its own package too; needs Redis *and* Postgres running

```bash
redis-server --daemonize yes          # or: docker run -d -p 6379:6379 redis

cd ../jobs   # projects/consent-vault-manager/jobs
npm install
npm run typecheck
npm test             # node:test over all six job functions — still against mock-store, no Redis/Postgres needed
npm run smoke-test   # reseeds Postgres, spawns the real worker, drives it over real Redis, asserts on its logs (fake gmail/calendar ids)
```

`jobs/tests/*.test.ts` deliberately keep testing against mock-store's
`InMemoryConsentVaultStore` (per the brief: mock-store stays as the test
double) — only `jobs/src/index.ts`, the live worker, was cut over to the
real repositories.

**Phase 7 env vars** (in whatever shell starts `npm start` — `jobs/` has no
`.env` loader of its own, same as `EXPIRY_SWEEP_INTERVAL_MS` before it):
`DPB_NOTIFICATION_EMAIL` (required for breach notice drafting — no default,
see the Phase 7 changelog above for why) and `SELF_NOTIFICATION_EMAIL`
(required for DSR SLA escalation and the weekly report — internal alerts go
to the fiduciary's own inbox, never the data principal). Both demo cadences
default to every 2/10 minutes (`DSR_SLA_ESCALATION_INTERVAL_MS`,
`WEEKLY_COMPLIANCE_REPORT_INTERVAL_MS`) — set to `86400000` /
`604800000` for real daily/weekly cadence.

```bash
# run it live in two terminals:
export DPB_NOTIFICATION_EMAIL="dpb-liaison@example.gov"
export SELF_NOTIFICATION_EMAIL="you@example.com"
npm start                              # terminal 1 — long-running worker, real Postgres + Redis
npm run fire:withdrawal -- consent-4   # terminal 2 — fires a mock withdrawal event
```

`consent-4` and `consent-6` are seeded as already-withdrawn artifacts whose
purposes (`purpose-4`/analytics, `purpose-1`/marketing) have active
processors, so either makes a good manual demo target. The expiry sweep
needs no manual trigger — `consent-12` is seeded deliberately stale, so the
very first sweep tick expires it for you (as long as Postgres has been
freshly reseeded — see step 2). The seeded overdue `dsr-2` needs no manual
trigger either — the very first DSR SLA escalation tick stages both its
T-7d and T-2d reminders for you.

With the worker running, drafted notifications show up on the
`pending-notifications` queue instead of being sent — review and confirm
them from a second terminal:

```bash
npm run list-pending                                          # see every drafted email/event/report awaiting confirmation
# ... create the real Gmail draft / Calendar event via Claude Code ...
npm run confirm -- <pendingJobId> --gmail-draft-id=<id>       # for a drafted email, including weekly_report
npm run confirm -- <pendingJobId> --calendar-event-id=<id>    # for a drafted calendar event
```

`confirm-notification.ts` has no Gmail/Calendar credentials itself — it
only records that a human (via Claude Code's live MCP tool access) already
created the real draft/event. Skipping straight to `confirm` without
actually creating anything just puts a fabricated id on the ledger, so
don't. For `weekly_report`, `list-pending` decodes the staged PDF to a
local temp file and prints the path, purely so you can look at the report
before drafting the email — confirming with `--gmail-draft-id` archives
the PDF to `jobs/reports/` automatically (local disk in place of Google
Drive for now — see the Phase 7 changelog above for why), no separate
upload step needed.

### 5. apps/dashboard — React + Vite, needs `apps/api` running

```bash
cd ../apps/dashboard   # projects/consent-vault-manager/apps/dashboard
npm install
cp .env.example .env.local   # adjust VITE_API_URL if apps/api isn't on :3000
npm run build                # tsc -b && vite build — typechecks + production bundle
npm run dev                  # Vite dev server, defaults to http://localhost:5173
```

Make sure `apps/api`'s `CORS_ORIGIN` matches whatever origin the dashboard
actually runs on (`http://localhost:5173` for the Vite dev server by
default) — cookies won't round-trip cross-origin otherwise. Sign in with
the `ADMIN_USERNAME`/password whose bcrypt hash you put in `apps/api/.env`.

## Next step

All phases from the original spec are now built and verified live end to
end, including the weekly compliance report (archived to local disk in
place of Google Drive — see the Phase 7 changelog above for the connector
regression that motivated that, and swap in a real `ReportArchiver` once
it's fixed upstream).
