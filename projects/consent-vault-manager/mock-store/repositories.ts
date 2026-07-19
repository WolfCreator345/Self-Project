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
 *   - ConsentRepository: DataFiduciary, DataPrincipal, Purpose, ConsentArtifact
 *   - DSRRepository:     DSRRequest
 *   - LedgerRepository:  ConsentLedgerEntry, BreachEvent (both audit/compliance
 *                        history, and get_compliance_snapshot needs both)
 */

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
  LedgerEntryType,
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

export interface ConsentRepository {
  getFiduciary(): Promise<DataFiduciary>;

  listPrincipals(params?: PageParams): Promise<DataPrincipal[]>;
  findPrincipalById(id: string): Promise<DataPrincipal | null>;

  listPurposes(params?: PageParams): Promise<Purpose[]>;
  findPurposeById(id: string): Promise<Purpose | null>;

  /** Backs the `create_consent_record` MCP tool. */
  createConsentArtifact(input: CreateConsentArtifactInput): Promise<ConsentArtifact>;
  /** Backs the `revoke_consent` MCP tool. Only valid from status "granted". */
  revokeConsentArtifact(id: string, reason: string): Promise<ConsentArtifact>;
  /** Used by the (future) expiry sweep automation. */
  markExpired(id: string): Promise<ConsentArtifact>;

  /** Backs the `check_consent_status` MCP tool. Returns the most recent artifact for the pair. */
  findConsentArtifact(principalId: string, purposeId: string): Promise<ConsentArtifact | null>;
  findConsentArtifactById(id: string): Promise<ConsentArtifact | null>;
  listConsentArtifacts(params?: ListConsentArtifactsParams): Promise<ConsentArtifact[]>;
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

export interface LedgerRepository {
  /** Append-only. There is deliberately no update/delete method on this interface. */
  appendEntry(input: AppendLedgerEntryInput): Promise<ConsentLedgerEntry>;
  listEntries(params?: ListLedgerEntriesParams): Promise<ConsentLedgerEntry[]>;

  createBreachEvent(input: CreateBreachEventInput): Promise<BreachEvent>;
  listBreachEvents(params?: PageParams): Promise<BreachEvent[]>;

  /** Backs the `get_compliance_snapshot` MCP tool. */
  getComplianceSnapshot(dateRange: DateRange): Promise<ComplianceSnapshot>;
}
