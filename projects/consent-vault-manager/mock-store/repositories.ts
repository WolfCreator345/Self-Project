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
}

export interface ListProcessorsParams extends PageParams {
  purposeId?: string;
  status?: ProcessorStatus;
}

export interface CreatePrincipalInput {
  name: string;
  email: string;
  phone?: string;
  isMinor: boolean;
  guardianName?: string;
  guardianEmail?: string;
}

export interface CreatePurposeInput {
  description: string;
  lawfulBasis: LawfulBasis;
  retentionPeriodDays: number;
}

export interface ConsentRepository {
  getFiduciary(): Promise<DataFiduciary>;

  listPrincipals(params?: PageParams): Promise<DataPrincipal[]>;
  findPrincipalById(id: string): Promise<DataPrincipal | null>;
  /** Onboards a new DataPrincipal. Added in Phase 4 for the principals CRUD endpoint. */
  createPrincipal(input: CreatePrincipalInput): Promise<DataPrincipal>;

  listPurposes(params?: PageParams): Promise<Purpose[]>;
  findPurposeById(id: string): Promise<Purpose | null>;
  /** Defines a new Purpose. Added in Phase 4 for the purposes CRUD endpoint. */
  createPurpose(input: CreatePurposeInput): Promise<Purpose>;

  /** Backs the `create_consent_record` MCP tool. */
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

// ─── DSRRepository ─────────────────────────────────────────────────────────

export interface CreateDSRRequestInput {
  principalId: string;
  type: DSRType;
}

export interface ListDSRRequestsParams extends PageParams {
  overdueOnly?: boolean;
  status?: DSRStatus;
  principalId?: string;
}

export interface DSRRepository {
  /** Backs the `create_dsr_request` MCP tool. */
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
  firstBreak?: LedgerIntegrityBreak;
}

export interface LedgerRepository {
  /** Append-only. There is deliberately no update/delete method on this interface. */
  appendEntry(input: AppendLedgerEntryInput): Promise<ConsentLedgerEntry>;
  listEntries(params?: ListLedgerEntriesParams): Promise<ConsentLedgerEntry[]>;

  createBreachEvent(input: CreateBreachEventInput): Promise<BreachEvent>;
  listBreachEvents(params?: PageParams): Promise<BreachEvent[]>;

  /** Backs the `get_compliance_snapshot` MCP tool. */
  getComplianceSnapshot(dateRange: DateRange): Promise<ComplianceSnapshot>;

  /**
   * Backs the `verify_ledger_integrity` MCP tool (Phase 5). Always walks
   * the full chain from genesis regardless of dateRange — a hash chain
   * can't be verified in isolation without the true prior link — but when
   * dateRange is given, only entries whose recordedAt falls inside it count
   * toward entriesChecked.
   */
  verifyLedgerIntegrity(dateRange?: DateRange): Promise<LedgerIntegrityReport>;
}
