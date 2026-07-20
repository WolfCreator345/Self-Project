// Re-exports (type-only) the entity types from mock-store/types.ts, the same
// interface source of truth apps/api's controllers are typed against — a
// dashboard-local duplicate would just drift. This is erased entirely at
// build time (verbatimModuleSyntax + `import type`), so it never needs
// mock-store's own ESM/NodeNext runtime resolution, only tsc's ability to
// find the .ts file for type-checking.
//
// Not re-exporting from mock-store/repositories.ts here: it imports
// LedgerIntegrityBreak from hashChain.ts, which has a runtime `node:crypto`
// import — fine in mock-store's own Node-targeted tsconfig, but this
// dashboard's browser-targeted tsconfig has no "node" types, so resolving
// that module fails. ComplianceSnapshot/LedgerIntegrityReport below are
// small, stable response shapes duplicated directly instead.
export type {
  BreachEvent,
  BreachSeverity,
  ConsentArtifact,
  ConsentLedgerEntry,
  ConsentStatus,
  DataPrincipal,
  DSRRequest,
  DSRStatus,
  DSRType,
  LawfulBasis,
  Purpose,
} from "../../../../mock-store/types";
import type { BreachEvent, ConsentArtifact, ConsentLedgerEntry, DSRRequest } from "../../../../mock-store/types";

/**
 * mock-store's entity interfaces type dates as `Date`, which is accurate for
 * the in-memory store but not for what actually arrives over the wire —
 * apps/api's JSON responses serialize every Date as an ISO string. These
 * "Wire" aliases are what the fetch layer should type responses as; convert
 * to real Date objects at the point of use if needed (e.g. sorting).
 */
type Serialized<T> = { [K in keyof T]: T[K] extends Date | undefined ? string : T[K] };

export type WireConsentArtifact = Serialized<ConsentArtifact>;
export type WireConsentLedgerEntry = Serialized<ConsentLedgerEntry>;
export type WireDSRRequest = Serialized<DSRRequest>;
export type WireBreachEvent = Serialized<BreachEvent>;

export interface DateRange {
  from: string;
  to: string;
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

export interface LedgerIntegrityBreak {
  sequence: number;
  entryId: string;
  reason: "previous_hash_mismatch" | "hash_mismatch";
  expected: string;
  actual: string;
}

export interface LedgerIntegrityReport {
  intact: boolean;
  entriesChecked: number;
  verifiedFullChain: boolean;
  firstBreak?: LedgerIntegrityBreak;
}
