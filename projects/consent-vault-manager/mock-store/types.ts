/**
 * Domain model for the Consent Vault Manager, per DPDP Act 2023.
 * Section references (e.g. "s.6") point to the DPDP anchor named in the build spec.
 */

export interface DataPrincipal {
  id: string;
  /** Which Data Fiduciary this principal's records belong to — Phase 8 multi-tenancy. */
  fiduciaryId: string;
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
  /** Which Data Fiduciary defines this purpose — Phase 8 multi-tenancy. */
  fiduciaryId: string;
  description: string;
  lawfulBasis: LawfulBasis;
  /** How long an artifact under this purpose remains valid before it must be renewed. */
  retentionPeriodDays: number;
  createdAt: Date;
}

export type ConsentStatus = "granted" | "withdrawn" | "expired";

export interface ConsentArtifact {
  id: string;
  /**
   * Which Data Fiduciary this consent belongs to — Phase 8 multi-tenancy.
   * Always equal to purpose.fiduciaryId (and principal.fiduciaryId, which
   * must match it); derived automatically at creation, never taken as
   * caller input, so nothing that creates a ConsentArtifact — including
   * mcp-server's create_consent_record, which stays tenant-unaware by
   * design — needs to know this field exists.
   */
  fiduciaryId: string;
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
  | "purge_followup_event_scheduled"
  | "breach_notice_drafted"
  | "breach_notice_deadline_scheduled"
  | "dsr_escalation_sent"
  | "weekly_report_sent";

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
  /** Always equal to principal.fiduciaryId — derived automatically at creation. Phase 8 multi-tenancy. */
  fiduciaryId: string;
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
  /**
   * Phase 8 multi-tenancy. Derived automatically at creation from the first
   * entry in affectedPurposeIds' fiduciaryId; report_breach_event stays
   * tenant-unaware by design, so when affectedPurposeIds is empty there's
   * no purpose to derive from, and this falls back to the platform's
   * primary DataFiduciary (the first one seeded) — a documented scope
   * boundary, not a general-purpose tenant resolution mechanism.
   */
  fiduciaryId: string;
  description: string;
  detectedAt: Date;
  dpbNotifyDueAt: Date;
  severity: BreachSeverity;
  /**
   * Purposes (categories of processing) affected by this breach — added in
   * Phase 7 for breach notice drafting, which needs to know which
   * principals to describe as affected. Rather than storing a redundant
   * principal list, "affected principals" is derived at draft time by
   * querying granted ConsentArtifacts for these purposes (mirrors how the
   * withdrawal cascade derives affected processors from a purpose rather
   * than storing them directly).
   */
  affectedPurposeIds: string[];
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
  /** Always equal to purpose.fiduciaryId. Phase 8 multi-tenancy. No runtime creation path exists — set at seed time only. */
  fiduciaryId: string;
  name: string;
  purposeId: string;
  status: ProcessorStatus;
  /** Mock contact address — where Phase 3's purge notice email gets addressed. */
  contactEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Phase 8: dashboard/API-side multi-tenancy and RBAC. Deliberately scoped to
 * apps/api's session-authenticated surface only — mcp-server and jobs/ stay
 * tenant-unaware (see the fiduciaryId derivation notes above), matching how
 * they've always operated as trusted, single-operator tools rather than
 * multi-tenant-aware ones.
 *
 * Three roles, each a strict superset of the one below it in read access:
 * - "admin": everything "dpo" can do, plus user management (create users,
 *   list/change roles) within their own fiduciary.
 * - "dpo": read + write within their own fiduciary — create principals/
 *   purposes, create/revoke consent artifacts. Cannot manage users.
 * - "viewer": read-only within their own fiduciary. Every write endpoint
 *   rejects a viewer with 403, regardless of what they're trying to change.
 */
export type Role = "admin" | "dpo" | "viewer";

export interface User {
  id: string;
  fiduciaryId: string;
  username: string;
  /** bcrypt hash — never the plaintext password. */
  passwordHash: string;
  role: Role;
  createdAt: Date;
}
