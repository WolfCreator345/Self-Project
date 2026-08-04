/**
 * Repository interfaces for the Consent Vault Manager.
 *
 * These are implemented by the in-memory mock store in Phase 0 (store.ts) and
 * must later be satisfied, unchanged, by a Postgres-backed implementation in
 * Phase 4 — nothing calling these interfaces (MCP server, job workers) should
 * need to change when that swap happens.
 *
 * Grouping note: the spec's domain model (section 2) lists 7 entities but only
 * 3 repositories. This implementation groups them as:
 *   - ConsentRepository: DataFiduciary, DataPrincipal, Purpose, ConsentArtifact,
 *                        Processor (added in Phase 2 — see types.ts)
 *   - DSRRepository:     DSRRequest
 *   - LedgerRepository:  ConsentLedgerEntry, BreachEvent (both audit/compliance
 *                        history, and get_compliance_snapshot needs both)
 */

import type { LedgerIntegrityBreak } from "./hashChain.js";
import type {
  BreachEvent,
  BreachSeverity,
  ConsentArtifact,
  ConsentLedgerEntry,
  ConsentStatus,
  DataFiduciary,
  DataPrincipal,
  DSRRequest,
  DSRStatus,
  DSRType,
  LawfulBasis,
  LedgerEntryType,
  Processor,
  ProcessorStatus,
  Purpose,
  Role,
  User,
} from "./types.js";

export interface PageParams {
  limit?: number;
  offset?: number;
}

// ─── ConsentRepository ────────────────────────────────────────────────────

export interface CreateConsentArtifactInput {
  principalId: string;
  purposeId: string;
  noticeVersion: string;
  language: string;
}

export interface ListConsentArtifactsParams extends PageParams {
  principalId?: string;
  purposeId?: string;
  status?: ConsentStatus;
  /** Phase 8: scopes results to one Data Fiduciary's tenant. Omit for the unscoped view (mcp-server/jobs). */
  fiduciaryId?: string;
}

export interface ListProcessorsParams extends PageParams {
  purposeId?: string;
  status?: ProcessorStatus;
}

export interface CreatePrincipalInput {
  /** Phase 8: which tenant this principal belongs to. Required — apps/api's controller derives it from the caller's session. */
  fiduciaryId: string;
  name: string;
  email: string;
  phone?: string;
  isMinor: boolean;
  guardianName?: string;
  guardianEmail?: string;
}

export interface CreatePurposeInput {
  /** Phase 8: which tenant defines this purpose. Required — apps/api's controller derives it from the caller's session. */
  fiduciaryId: string;
  description: string;
  lawfulBasis: LawfulBasis;
  retentionPeriodDays: number;
}

export interface ConsentRepository {
  /**
   * The platform's primary/first-seeded fiduciary — the implicit tenant
   * mcp-server and jobs/ act on behalf of when an entity they create (e.g.
   * a BreachEvent with no affectedPurposeIds) has no other way to derive
   * its fiduciaryId. Not a general multi-tenant lookup; see
   * findFiduciaryById/listFiduciaries for that.
   */
  getFiduciary(): Promise<DataFiduciary>;
  findFiduciaryById(id: string): Promise<DataFiduciary | null>;
  listFiduciaries(): Promise<DataFiduciary[]>;

  listPrincipals(params?: PageParams & { fiduciaryId?: string }): Promise<DataPrincipal[]>;
  findPrincipalById(id: string): Promise<DataPrincipal | null>;
  /** Onboards a new DataPrincipal. Added in Phase 4 for the principals CRUD endpoint. */
  createPrincipal(input: CreatePrincipalInput): Promise<DataPrincipal>;

  listPurposes(params?: PageParams & { fiduciaryId?: string }): Promise<Purpose[]>;
  findPurposeById(id: string): Promise<Purpose | null>;
  /** Defines a new Purpose. Added in Phase 4 for the purposes CRUD endpoint. */
  createPurpose(input: CreatePurposeInput): Promise<Purpose>;

  /**
   * Backs the `create_consent_record` MCP tool. fiduciaryId is derived
   * internally from the referenced purpose (Phase 8) — not caller input,
   * so this signature and every existing caller are unchanged.
   */
  createConsentArtifact(input: CreateConsentArtifactInput): Promise<ConsentArtifact>;
  /** Backs the `revoke_consent` MCP tool. Only valid from status "granted". */
  revokeConsentArtifact(id: string, reason: string): Promise<ConsentArtifact>;
  /** Used by the expiry sweep automation (jobs/). */
  markExpired(id: string): Promise<ConsentArtifact>;

  /** Backs the `check_consent_status` MCP tool. Returns the most recent artifact for the pair. */
  findConsentArtifact(principalId: string, purposeId: string): Promise<ConsentArtifact | null>;
  findConsentArtifactById(id: string): Promise<ConsentArtifact | null>;
  listConsentArtifacts(params?: ListConsentArtifactsParams): Promise<ConsentArtifact[]>;

  /** Used by the withdrawal cascade automation (jobs/) to find what to flag for a purpose. */
  listProcessors(params?: ListProcessorsParams): Promise<Processor[]>;
  /** Marks a processor for purge/notify and writes a ledger entry. Used by the withdrawal cascade automation. */
  markProcessorForPurge(id: string, reason: string): Promise<Processor>;
}

// ─── UserRepository (Phase 8: multi-tenant + RBAC) ─────────────────────────

export interface CreateUserInput {
  fiduciaryId: string;
  username: string;
  /** Already-hashed (bcrypt) — this layer never sees or handles a plaintext password. */
  passwordHash: string;
  role: Role;
}

export interface UserRepository {
  createUser(input: CreateUserInput): Promise<User>;
  /** Used by login — usernames are unique platform-wide, not just per-tenant, since login happens before a tenant is known. */
  findUserByUsername(username: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  /** Always scoped — there is no unscoped "list every user on the platform" method, deliberately. */
  listUsers(fiduciaryId: string, params?: PageParams): Promise<User[]>;
  updateUserRole(id: string, role: Role): Promise<User>;
}

// ─── DSRRepository ─────────────────────────────────────────────────────────

export interface CreateDSRRequestInput {
  principalId: string;
  type: DSRType;
}

export interface ListDSRRequestsParams extends PageParams {
  overdueOnly?: boolean;
  status?: DSRStatus;
  principalId?: string;
  /** Added in Phase 6 for the dashboard's DSR queue type filter. */
  type?: DSRType;
  /** Phase 8: scopes results to one Data Fiduciary's tenant. Omit for the unscoped view (mcp-server/jobs). */
  fiduciaryId?: string;
}

export interface DSRRepository {
  /**
   * Backs the `create_dsr_request` MCP tool. fiduciaryId is derived
   * internally from the referenced principal (Phase 8) — not caller input.
   */
  createDSRRequest(input: CreateDSRRequestInput): Promise<DSRRequest>;
  findDSRRequestById(id: string): Promise<DSRRequest | null>;
  /** Backs the `list_open_dsr_requests` MCP tool. */
  listDSRRequests(params?: ListDSRRequestsParams): Promise<DSRRequest[]>;
  updateDSRStatus(id: string, status: DSRStatus): Promise<DSRRequest>;
}

// ─── LedgerRepository ───────────────────────────────────────────────────────

export interface AppendLedgerEntryInput {
  entryType: LedgerEntryType;
  refId: string;
  principalId?: string;
  detail: Record<string, unknown>;
}

export interface ListLedgerEntriesParams extends PageParams {
  principalId?: string;
  refId?: string;
  entryType?: LedgerEntryType;
}

export interface CreateBreachEventInput {
  description: string;
  detectedAt: Date;
  dpbNotifyDueAt: Date;
  severity: BreachSeverity;
  /** Purposes affected by this breach. Defaults to [] if omitted. Phase 7. */
  affectedPurposeIds?: string[];
}

export interface ListBreachEventsParams extends PageParams {
  /** Phase 8: scopes results to one Data Fiduciary's tenant. Omit for the unscoped view (mcp-server/jobs). */
  fiduciaryId?: string;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ComplianceSnapshot {
  dateRange: DateRange;
  consentsGranted: number;
  consentsWithdrawn: number;
  consentsExpired: number;
  dsrOpen: number;
  dsrOverdue: number;
  dsrResolved: number;
  breachesLogged: number;
}

export interface LedgerIntegrityReport {
  intact: boolean;
  entriesChecked: number;
  /** True if this call walked the full chain from genesis; false if it only checked entries past a cached checkpoint. */
  verifiedFullChain: boolean;
  firstBreak?: LedgerIntegrityBreak;
}

export interface LedgerRepository {
  /** Append-only. There is deliberately no update/delete method on this interface. */
  appendEntry(input: AppendLedgerEntryInput): Promise<ConsentLedgerEntry>;
  listEntries(params?: ListLedgerEntriesParams): Promise<ConsentLedgerEntry[]>;

  /**
   * Backs the `report_breach_event` MCP tool. fiduciaryId is derived
   * internally (Phase 8) — see BreachEvent's doc comment in types.ts for
   * exactly how — not caller input.
   */
  createBreachEvent(input: CreateBreachEventInput): Promise<BreachEvent>;
  listBreachEvents(params?: ListBreachEventsParams): Promise<BreachEvent[]>;
  /** Added in Phase 7 for the breach-notice-drafting job to load the triggering event. */
  findBreachEventById(id: string): Promise<BreachEvent | null>;

  /**
   * Backs the `get_compliance_snapshot` MCP tool, called with no
   * fiduciaryId there (mcp-server stays tenant-unscoped) — aggregates
   * across every tenant. apps/api's dashboard-facing controller passes the
   * caller's fiduciaryId (Phase 8) to scope the snapshot to their tenant
   * alone.
   */
  getComplianceSnapshot(dateRange: DateRange, fiduciaryId?: string): Promise<ComplianceSnapshot>;

  /**
   * Backs the `verify_ledger_integrity` MCP tool. By default (Phase 6),
   * incrementally verifies only entries past the last successfully-verified
   * checkpoint (an internally-cached {sequence, hash} pair) — checking that
   * the first new entry's previousHash matches the cached hash, then
   * walking forward from there, rather than re-walking the entire chain on
   * every call. Pass verifyFullChain: true to force a full walk from
   * genesis regardless of any cached checkpoint (a "deep verify"). Falls
   * back to a full walk automatically if the cached checkpoint no longer
   * matches the data (e.g. it was reseeded out-of-band since the last check).
   * When dateRange is given, only entries whose recordedAt falls inside it
   * count toward entriesChecked — entriesChecked otherwise reflects exactly
   * what this call examined (the incremental delta, or everything on a full
   * walk), not the full ledger size.
   *
   * Deliberately NOT tenant-scoped (Phase 8): the hash chain is one global,
   * strictly sequential structure — entries from every tenant interleave in
   * it by append order, and mcp-server/jobs write to it without any
   * fiduciaryId at all. Splitting it into per-tenant chains would be a much
   * larger redesign than this phase's scope. Its result (intact/broken,
   * a count, a sequence number) carries no tenant-specific business data,
   * so showing the whole platform's chain health to every authenticated
   * user regardless of role or tenant is a deliberate, safe choice, not an
   * oversight.
   */
  verifyLedgerIntegrity(dateRange?: DateRange, verifyFullChain?: boolean): Promise<LedgerIntegrityReport>;
}
