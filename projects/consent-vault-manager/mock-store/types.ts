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
  | "breach_logged"
  | "processor_purge_flagged"
  | "renewal_email_drafted"
  | "purge_notice_email_drafted"
  | "purge_followup_event_scheduled";

/**
 * One immutable row per state change. Append-only.
 * Hash-chained as of Phase 5: `hash` = SHA-256(previousHash + this entry's own
 * canonicalized fields), `previousHash` links to the prior entry's `hash`
 * (or LEDGER_GENESIS_HASH for the very first entry). See hashChain.ts.
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
  previousHash: string;
  hash: string;
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

export type ProcessorStatus = "active" | "purge_pending" | "purged";

/**
 * A downstream data processor that receives principal data under a given
 * Purpose (e.g. a CRM, an analytics vendor). Not part of the spec's section 2
 * table — added in Phase 2 because the withdrawal cascade automation (section
 * 4, #2) explicitly needs "downstream processor records tied to that purpose"
 * to walk and flag, and nothing in Phase 0/1 modeled them yet.
 */
export interface Processor {
  id: string;
  name: string;
  purposeId: string;
  status: ProcessorStatus;
  /** Mock contact address — where Phase 3's purge notice email gets addressed. */
  contactEmail: string;
  createdAt: Date;
  updatedAt: Date;
}
