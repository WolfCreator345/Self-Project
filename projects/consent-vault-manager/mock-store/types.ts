/**
 * Domain model for the Consent Vault Manager, per DPDP Act 2023.
 * Section references (e.g. "s.6") point to the DPDP anchor named in the build spec.
 */

export interface DataPrincipal {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** True if this principal is a minor and processing requires guardian consent (s.9). */
  isMinor: boolean;
  guardianName?: string;
  guardianEmail?: string;
  createdAt: Date;
}

export interface DataFiduciary {
  id: string;
  name: string;
  dpoName: string;
  dpoEmail: string;
  createdAt: Date;
}

export type LawfulBasis = "consent" | "legitimate_use";

export interface Purpose {
  id: string;
  description: string;
  lawfulBasis: LawfulBasis;
  /** How long an artifact under this purpose remains valid before it must be renewed. */
  retentionPeriodDays: number;
  createdAt: Date;
}

export type ConsentStatus = "granted" | "withdrawn" | "expired";

export interface ConsentArtifact {
  id: string;
  principalId: string;
  purposeId: string;
  status: ConsentStatus;
  grantedAt: Date;
  withdrawnAt?: Date;
  /** grantedAt + purpose.retentionPeriodDays at the time consent was recorded. */
  expiresAt: Date;
  noticeVersion: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export type LedgerEntryType =
  | "consent_granted"
  | "consent_withdrawn"
  | "consent_expired"
  | "dsr_created"
  | "dsr_resolved"
  | "breach_logged";

/**
 * One immutable row per state change. Append-only.
 * Hash-chaining (prevHash/hash) is intentionally NOT part of this Phase 0 shape —
 * it's added in Phase 5 against the real Postgres-backed ledger table, per the spec.
 */
export interface ConsentLedgerEntry {
  id: string;
  /** Monotonically increasing append order. */
  sequence: number;
  entryType: LedgerEntryType;
  /** id of the ConsentArtifact / DSRRequest / BreachEvent this entry describes. */
  refId: string;
  principalId?: string;
  detail: Record<string, unknown>;
  recordedAt: Date;
}

export type DSRType = "access" | "correction" | "erasure" | "nomination";
export type DSRStatus = "open" | "in_progress" | "resolved" | "overdue";

export interface DSRRequest {
  id: string;
  principalId: string;
  type: DSRType;
  submittedAt: Date;
  dueAt: Date;
  status: DSRStatus;
  resolvedAt?: Date;
  createdAt: Date;
}

export type BreachSeverity = "low" | "medium" | "high" | "critical";

export interface BreachEvent {
  id: string;
  description: string;
  detectedAt: Date;
  dpbNotifyDueAt: Date;
  severity: BreachSeverity;
  createdAt: Date;
}
