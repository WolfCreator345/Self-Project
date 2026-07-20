import { computeLedgerEntryHash, LEDGER_GENESIS_HASH } from "./hashChain.js";
import type {
  BreachEvent,
  ConsentArtifact,
  ConsentLedgerEntry,
  DataFiduciary,
  DataPrincipal,
  DSRRequest,
  LedgerEntryType,
  Processor,
  Purpose,
} from "./types.js";

export interface SeedData {
  fiduciary: DataFiduciary;
  principals: DataPrincipal[];
  purposes: Purpose[];
  consentArtifacts: ConsentArtifact[];
  dsrRequests: DSRRequest[];
  breachEvents: BreachEvent[];
  processors: Processor[];
  ledgerEntries: ConsentLedgerEntry[];
}

const d = (iso: string) => new Date(iso);

/**
 * Deterministic fake data for demos and tests. Every call returns fresh
 * object instances (no shared references) so multiple stores/tests don't
 * bleed mutations into each other.
 */
export function createSeedData(): SeedData {
  const fiduciary: DataFiduciary = {
    id: "fiduciary-1",
    name: "LexEdu Technologies Pvt. Ltd.",
    dpoName: "Meera Krishnan",
    dpoEmail: "dpo@lexedu.example",
    createdAt: d("2023-01-01"),
  };

  const purposes: Purpose[] = [
    {
      id: "purpose-1",
      description: "Marketing communications and promotional offers",
      lawfulBasis: "consent",
      retentionPeriodDays: 365,
      createdAt: d("2023-01-01"),
    },
    {
      id: "purpose-2",
      description: "Account creation and service delivery",
      lawfulBasis: "consent",
      retentionPeriodDays: 1095,
      createdAt: d("2023-01-01"),
    },
    {
      id: "purpose-3",
      description: "Fraud prevention and security monitoring",
      lawfulBasis: "legitimate_use",
      retentionPeriodDays: 180,
      createdAt: d("2023-01-01"),
    },
    {
      id: "purpose-4",
      description: "Analytics and product improvement",
      lawfulBasis: "consent",
      retentionPeriodDays: 730,
      createdAt: d("2023-01-01"),
    },
  ];

  const principals: DataPrincipal[] = [
    { id: "principal-1", name: "Aditi Sharma", email: "aditi.sharma@example.com", isMinor: false, createdAt: d("2024-02-10") },
    { id: "principal-2", name: "Rohan Mehta", email: "rohan.mehta@example.com", isMinor: false, createdAt: d("2024-01-20") },
    { id: "principal-3", name: "Priya Nair", email: "priya.nair@example.com", isMinor: false, createdAt: d("2024-03-05") },
    {
      id: "principal-4",
      name: "Karan Verma",
      email: "karan.verma@example.com",
      isMinor: true,
      guardianName: "Sunita Verma",
      guardianEmail: "sunita.verma@example.com",
      createdAt: d("2025-11-01"),
    },
    { id: "principal-5", name: "Ananya Iyer", email: "ananya.iyer@example.com", isMinor: false, createdAt: d("2024-06-18") },
    { id: "principal-6", name: "Vikram Singh", email: "vikram.singh@example.com", isMinor: false, createdAt: d("2023-04-22") },
    { id: "principal-7", name: "Fatima Khan", email: "fatima.khan@example.com", isMinor: false, createdAt: d("2025-02-14") },
    {
      id: "principal-8",
      name: "Arjun Reddy",
      email: "arjun.reddy@example.com",
      isMinor: true,
      guardianName: "Lakshmi Reddy",
      guardianEmail: "lakshmi.reddy@example.com",
      createdAt: d("2026-06-20"),
    },
  ];

  // grantedAt/expiresAt are hand-set to be internally consistent with each
  // purpose's retentionPeriodDays (approximated to whole months, not exact
  // day-math) so the mix reads sensibly against "today" (2026-07-19).
  const consentArtifacts: ConsentArtifact[] = [
    { id: "consent-1", principalId: "principal-1", purposeId: "purpose-2", status: "granted", grantedAt: d("2025-03-01"), expiresAt: d("2028-03-01"), noticeVersion: "v1.2", language: "en", createdAt: d("2025-03-01"), updatedAt: d("2025-03-01") },
    { id: "consent-2", principalId: "principal-1", purposeId: "purpose-1", status: "expired", grantedAt: d("2024-05-01"), expiresAt: d("2025-05-01"), noticeVersion: "v1.0", language: "en", createdAt: d("2024-05-01"), updatedAt: d("2025-05-01") },
    { id: "consent-3", principalId: "principal-2", purposeId: "purpose-2", status: "granted", grantedAt: d("2025-06-15"), expiresAt: d("2028-06-15"), noticeVersion: "v1.2", language: "en", createdAt: d("2025-06-15"), updatedAt: d("2025-06-15") },
    { id: "consent-4", principalId: "principal-2", purposeId: "purpose-4", status: "withdrawn", grantedAt: d("2024-01-10"), withdrawnAt: d("2025-02-01"), expiresAt: d("2026-01-10"), noticeVersion: "v1.0", language: "en", createdAt: d("2024-01-10"), updatedAt: d("2025-02-01") },
    { id: "consent-5", principalId: "principal-3", purposeId: "purpose-3", status: "granted", grantedAt: d("2026-06-01"), expiresAt: d("2026-11-28"), noticeVersion: "v1.3", language: "en", createdAt: d("2026-06-01"), updatedAt: d("2026-06-01") },
    { id: "consent-6", principalId: "principal-3", purposeId: "purpose-1", status: "withdrawn", grantedAt: d("2025-08-01"), withdrawnAt: d("2026-01-15"), expiresAt: d("2026-08-01"), noticeVersion: "v1.1", language: "hi", createdAt: d("2025-08-01"), updatedAt: d("2026-01-15") },
    { id: "consent-7", principalId: "principal-4", purposeId: "purpose-2", status: "granted", grantedAt: d("2026-04-01"), expiresAt: d("2029-04-01"), noticeVersion: "v1.3", language: "en", createdAt: d("2026-04-01"), updatedAt: d("2026-04-01") },
    { id: "consent-8", principalId: "principal-5", purposeId: "purpose-4", status: "granted", grantedAt: d("2025-09-01"), expiresAt: d("2027-09-01"), noticeVersion: "v1.2", language: "en", createdAt: d("2025-09-01"), updatedAt: d("2025-09-01") },
    { id: "consent-9", principalId: "principal-6", purposeId: "purpose-1", status: "expired", grantedAt: d("2023-06-01"), expiresAt: d("2024-06-01"), noticeVersion: "v1.0", language: "en", createdAt: d("2023-06-01"), updatedAt: d("2024-06-01") },
    { id: "consent-10", principalId: "principal-7", purposeId: "purpose-3", status: "withdrawn", grantedAt: d("2026-03-01"), withdrawnAt: d("2026-05-10"), expiresAt: d("2026-08-28"), noticeVersion: "v1.3", language: "en", createdAt: d("2026-03-01"), updatedAt: d("2026-05-10") },
    { id: "consent-11", principalId: "principal-8", purposeId: "purpose-2", status: "granted", grantedAt: d("2026-07-01"), expiresAt: d("2029-07-01"), noticeVersion: "v1.3", language: "en", createdAt: d("2026-07-01"), updatedAt: d("2026-07-01") },
    // Deliberately stale: still "granted" but expiresAt is well before "today" (2026-07-19) —
    // simulates a record the expiry sweep job hasn't processed yet, so Phase 2's job has
    // something real to do on its first run.
    { id: "consent-12", principalId: "principal-7", purposeId: "purpose-1", status: "granted", grantedAt: d("2024-06-01"), expiresAt: d("2025-06-01"), noticeVersion: "v1.1", language: "en", createdAt: d("2024-06-01"), updatedAt: d("2024-06-01") },
  ];

  const processors: Processor[] = [
    { id: "processor-1", name: "MailBlast CRM", purposeId: "purpose-1", status: "active", contactEmail: "privacy@mailblastcrm.example", createdAt: d("2023-02-01"), updatedAt: d("2023-02-01") },
    { id: "processor-2", name: "AdInsight Retargeting", purposeId: "purpose-1", status: "active", contactEmail: "dpo@adinsight.example", createdAt: d("2023-02-01"), updatedAt: d("2023-02-01") },
    { id: "processor-3", name: "CoreBank Onboarding Suite", purposeId: "purpose-2", status: "active", contactEmail: "compliance@corebanksuite.example", createdAt: d("2023-02-01"), updatedAt: d("2023-02-01") },
    { id: "processor-4", name: "SentinelGuard Fraud Detection", purposeId: "purpose-3", status: "active", contactEmail: "privacy@sentinelguard.example", createdAt: d("2023-02-01"), updatedAt: d("2023-02-01") },
    { id: "processor-5", name: "PixelMetrics Analytics", purposeId: "purpose-4", status: "active", contactEmail: "dpo@pixelmetrics.example", createdAt: d("2023-02-01"), updatedAt: d("2023-02-01") },
    { id: "processor-6", name: "ChurnSignal ML Platform", purposeId: "purpose-4", status: "active", contactEmail: "privacy@churnsignal.example", createdAt: d("2023-02-01"), updatedAt: d("2023-02-01") },
  ];

  const dsrRequests: DSRRequest[] = [
    { id: "dsr-1", principalId: "principal-2", type: "access", submittedAt: d("2026-07-05"), dueAt: d("2026-08-04"), status: "open", createdAt: d("2026-07-05") },
    // Overdue: dueAt is before "today" (2026-07-19) and never resolved.
    { id: "dsr-2", principalId: "principal-5", type: "erasure", submittedAt: d("2026-06-01"), dueAt: d("2026-07-01"), status: "overdue", createdAt: d("2026-06-01") },
    { id: "dsr-3", principalId: "principal-6", type: "correction", submittedAt: d("2026-07-15"), dueAt: d("2026-08-14"), status: "open", createdAt: d("2026-07-15") },
  ];

  const breachEvents: BreachEvent[] = [
    {
      id: "breach-1",
      description: "Unauthorized access to a marketing database export file",
      detectedAt: d("2026-07-10"),
      dpbNotifyDueAt: d("2026-07-13"),
      severity: "high",
      affectedPurposeIds: ["purpose-1"],
      createdAt: d("2026-07-10"),
    },
  ];

  const ledgerEntries = buildLedgerEntries(consentArtifacts, dsrRequests, breachEvents);

  return { fiduciary, principals, purposes, consentArtifacts, dsrRequests, breachEvents, processors, ledgerEntries };
}

/** Derives one ledger row per historical state change, in chronological order. */
function buildLedgerEntries(
  consentArtifacts: ConsentArtifact[],
  dsrRequests: DSRRequest[],
  breachEvents: BreachEvent[],
): ConsentLedgerEntry[] {
  type Draft = { at: Date; entryType: LedgerEntryType; refId: string; principalId?: string; detail: Record<string, unknown> };
  const drafts: Draft[] = [];

  for (const c of consentArtifacts) {
    drafts.push({ at: c.grantedAt, entryType: "consent_granted", refId: c.id, principalId: c.principalId, detail: { purposeId: c.purposeId, noticeVersion: c.noticeVersion } });
    if (c.status === "withdrawn" && c.withdrawnAt) {
      drafts.push({ at: c.withdrawnAt, entryType: "consent_withdrawn", refId: c.id, principalId: c.principalId, detail: { purposeId: c.purposeId } });
    }
    if (c.status === "expired") {
      drafts.push({ at: c.expiresAt, entryType: "consent_expired", refId: c.id, principalId: c.principalId, detail: { purposeId: c.purposeId } });
    }
  }
  for (const req of dsrRequests) {
    drafts.push({ at: req.submittedAt, entryType: "dsr_created", refId: req.id, principalId: req.principalId, detail: { type: req.type } });
  }
  for (const b of breachEvents) {
    drafts.push({ at: b.detectedAt, entryType: "breach_logged", refId: b.id, detail: { severity: b.severity } });
  }

  // Timestamp order decides which sequence number a historical entry gets
  // (this is a narrative fiction for seed data — these events never really
  // happened in real time).
  drafts.sort((a, b) => a.at.getTime() - b.at.getTime());

  const withSequence = drafts.map((draft, index) => ({ ...draft, sequence: index + 1 }));

  // Hash chaining always follows `sequence`, not the timestamp it was
  // derived from — re-sorting here (a no-op given the above, but explicit)
  // is what the real backfill script and PrismaLedgerRepository also do,
  // since write order and timestamp order aren't guaranteed to agree once
  // real wall-clock writes are involved.
  withSequence.sort((a, b) => a.sequence - b.sequence);

  let previousHash = LEDGER_GENESIS_HASH;
  return withSequence.map((draft) => {
    const partial = {
      id: `ledger-${draft.sequence}`,
      sequence: draft.sequence,
      entryType: draft.entryType,
      refId: draft.refId,
      principalId: draft.principalId,
      detail: draft.detail,
      recordedAt: draft.at,
    };
    const hash = computeLedgerEntryHash(previousHash, partial);
    const entry: ConsentLedgerEntry = { ...partial, previousHash, hash };
    previousHash = hash;
    return entry;
  });
}
