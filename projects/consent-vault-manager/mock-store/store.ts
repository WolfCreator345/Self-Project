import { randomUUID } from "node:crypto";

import { computeLedgerEntryHash, LEDGER_GENESIS_HASH, verifyChain } from "./hashChain.js";
import type {
  AppendLedgerEntryInput,
  ComplianceSnapshot,
  ConsentRepository,
  CreateBreachEventInput,
  CreateConsentArtifactInput,
  CreateDSRRequestInput,
  CreatePrincipalInput,
  CreatePurposeInput,
  DateRange,
  DSRRepository,
  LedgerIntegrityReport,
  LedgerRepository,
  ListConsentArtifactsParams,
  ListDSRRequestsParams,
  ListLedgerEntriesParams,
  ListProcessorsParams,
  PageParams,
} from "./repositories.js";
import type {
  BreachEvent,
  ConsentArtifact,
  ConsentLedgerEntry,
  DataFiduciary,
  DataPrincipal,
  DSRRequest,
  DSRStatus,
  Processor,
  Purpose,
} from "./types.js";
import type { SeedData } from "./seed.js";
import { addDays, paginate } from "./util.js";

/** Data Subject Rights response SLA, per the spec's "30-day SLA" note. */
const DSR_SLA_DAYS = 30;

/**
 * In-memory implementation of ConsentRepository, DSRRepository, and
 * LedgerRepository. A single class backs all three so operations like
 * getComplianceSnapshot can read across consent/DSR/ledger data without
 * the interfaces themselves needing cross-repository references — a real
 * Postgres-backed implementation would do the equivalent with joined
 * queries or injected services.
 */
export class InMemoryConsentVaultStore implements ConsentRepository, DSRRepository, LedgerRepository {
  private readonly fiduciary: DataFiduciary;
  private readonly principals = new Map<string, DataPrincipal>();
  private readonly purposes = new Map<string, Purpose>();
  private readonly consentArtifacts = new Map<string, ConsentArtifact>();
  private readonly dsrRequests = new Map<string, DSRRequest>();
  private readonly breachEvents = new Map<string, BreachEvent>();
  private readonly processors = new Map<string, Processor>();
  private readonly ledgerEntries: ConsentLedgerEntry[] = [];
  private sequence = 0;
  /** Hash of the most recently appended ledger entry, or genesis if none yet. */
  private lastHash: string = LEDGER_GENESIS_HASH;
  /** Last checkpoint verifyLedgerIntegrity successfully verified up to. Phase 6. */
  private lastVerifiedCheckpoint: { sequence: number; hash: string } | null = null;

  constructor(seed: SeedData) {
    this.fiduciary = seed.fiduciary;
    for (const p of seed.principals) this.principals.set(p.id, p);
    for (const p of seed.purposes) this.purposes.set(p.id, p);
    for (const c of seed.consentArtifacts) this.consentArtifacts.set(c.id, c);
    for (const req of seed.dsrRequests) this.dsrRequests.set(req.id, req);
    for (const b of seed.breachEvents) this.breachEvents.set(b.id, b);
    for (const p of seed.processors) this.processors.set(p.id, p);
    for (const entry of seed.ledgerEntries) this.ledgerEntries.push(entry);
    this.sequence = seed.ledgerEntries.length;
    const lastSeeded = seed.ledgerEntries.at(-1);
    if (lastSeeded) this.lastHash = lastSeeded.hash;
  }

  // ─── ConsentRepository ───────────────────────────────────────────────────

  async getFiduciary(): Promise<DataFiduciary> {
    return this.fiduciary;
  }

  async listPrincipals(params?: PageParams): Promise<DataPrincipal[]> {
    return paginate([...this.principals.values()], params);
  }

  async findPrincipalById(id: string): Promise<DataPrincipal | null> {
    return this.principals.get(id) ?? null;
  }

  async createPrincipal(input: CreatePrincipalInput): Promise<DataPrincipal> {
    const principal: DataPrincipal = { id: randomUUID(), createdAt: new Date(), ...input };
    this.principals.set(principal.id, principal);
    return principal;
  }

  async listPurposes(params?: PageParams): Promise<Purpose[]> {
    return paginate([...this.purposes.values()], params);
  }

  async findPurposeById(id: string): Promise<Purpose | null> {
    return this.purposes.get(id) ?? null;
  }

  async createPurpose(input: CreatePurposeInput): Promise<Purpose> {
    const purpose: Purpose = { id: randomUUID(), createdAt: new Date(), ...input };
    this.purposes.set(purpose.id, purpose);
    return purpose;
  }

  async createConsentArtifact(input: CreateConsentArtifactInput): Promise<ConsentArtifact> {
    const principal = this.principals.get(input.principalId);
    if (!principal) throw new Error(`Unknown principal: ${input.principalId}`);
    const purpose = this.purposes.get(input.purposeId);
    if (!purpose) throw new Error(`Unknown purpose: ${input.purposeId}`);

    const now = new Date();
    const artifact: ConsentArtifact = {
      id: randomUUID(),
      principalId: input.principalId,
      purposeId: input.purposeId,
      status: "granted",
      grantedAt: now,
      expiresAt: addDays(now, purpose.retentionPeriodDays),
      noticeVersion: input.noticeVersion,
      language: input.language,
      createdAt: now,
      updatedAt: now,
    };
    this.consentArtifacts.set(artifact.id, artifact);
    await this.appendEntry({
      entryType: "consent_granted",
      refId: artifact.id,
      principalId: artifact.principalId,
      detail: { purposeId: artifact.purposeId, noticeVersion: artifact.noticeVersion },
    });
    return artifact;
  }

  async revokeConsentArtifact(id: string, reason: string): Promise<ConsentArtifact> {
    const artifact = this.consentArtifacts.get(id);
    if (!artifact) throw new Error(`Unknown consent artifact: ${id}`);
    if (artifact.status !== "granted") {
      throw new Error(`Cannot revoke consent artifact "${id}" from status "${artifact.status}"`);
    }

    const updated: ConsentArtifact = {
      ...artifact,
      status: "withdrawn",
      withdrawnAt: new Date(),
      updatedAt: new Date(),
    };
    this.consentArtifacts.set(id, updated);
    await this.appendEntry({
      entryType: "consent_withdrawn",
      refId: id,
      principalId: artifact.principalId,
      detail: { purposeId: artifact.purposeId, reason },
    });
    return updated;
  }

  async markExpired(id: string): Promise<ConsentArtifact> {
    const artifact = this.consentArtifacts.get(id);
    if (!artifact) throw new Error(`Unknown consent artifact: ${id}`);

    const previousStatus = artifact.status;
    const updated: ConsentArtifact = { ...artifact, status: "expired", updatedAt: new Date() };
    this.consentArtifacts.set(id, updated);
    await this.appendEntry({
      entryType: "consent_expired",
      refId: id,
      principalId: artifact.principalId,
      detail: {
        purposeId: artifact.purposeId,
        previousStatus,
        newStatus: updated.status,
        changedAt: updated.updatedAt.toISOString(),
      },
    });
    return updated;
  }

  async findConsentArtifact(principalId: string, purposeId: string): Promise<ConsentArtifact | null> {
    const matches = [...this.consentArtifacts.values()].filter(
      (c) => c.principalId === principalId && c.purposeId === purposeId,
    );
    if (matches.length === 0) return null;
    return matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
  }

  async findConsentArtifactById(id: string): Promise<ConsentArtifact | null> {
    return this.consentArtifacts.get(id) ?? null;
  }

  async listConsentArtifacts(params?: ListConsentArtifactsParams): Promise<ConsentArtifact[]> {
    let items = [...this.consentArtifacts.values()];
    if (params?.principalId) items = items.filter((c) => c.principalId === params.principalId);
    if (params?.purposeId) items = items.filter((c) => c.purposeId === params.purposeId);
    if (params?.status) items = items.filter((c) => c.status === params.status);
    return paginate(items, params);
  }

  async listProcessors(params?: ListProcessorsParams): Promise<Processor[]> {
    let items = [...this.processors.values()];
    if (params?.purposeId) items = items.filter((p) => p.purposeId === params.purposeId);
    if (params?.status) items = items.filter((p) => p.status === params.status);
    return paginate(items, params);
  }

  async markProcessorForPurge(id: string, reason: string): Promise<Processor> {
    const processor = this.processors.get(id);
    if (!processor) throw new Error(`Unknown processor: ${id}`);

    const updated: Processor = { ...processor, status: "purge_pending", updatedAt: new Date() };
    this.processors.set(id, updated);
    await this.appendEntry({
      entryType: "processor_purge_flagged",
      refId: id,
      detail: { purposeId: processor.purposeId, processorName: processor.name, reason },
    });
    return updated;
  }

  // ─── DSRRepository ───────────────────────────────────────────────────────

  async createDSRRequest(input: CreateDSRRequestInput): Promise<DSRRequest> {
    const principal = this.principals.get(input.principalId);
    if (!principal) throw new Error(`Unknown principal: ${input.principalId}`);

    const now = new Date();
    const request: DSRRequest = {
      id: randomUUID(),
      principalId: input.principalId,
      type: input.type,
      submittedAt: now,
      dueAt: addDays(now, DSR_SLA_DAYS),
      status: "open",
      createdAt: now,
    };
    this.dsrRequests.set(request.id, request);
    await this.appendEntry({
      entryType: "dsr_created",
      refId: request.id,
      principalId: request.principalId,
      detail: { type: request.type },
    });
    return request;
  }

  async findDSRRequestById(id: string): Promise<DSRRequest | null> {
    return this.dsrRequests.get(id) ?? null;
  }

  async listDSRRequests(params?: ListDSRRequestsParams): Promise<DSRRequest[]> {
    let items = [...this.dsrRequests.values()];
    if (params?.overdueOnly) {
      const now = new Date();
      items = items.filter((req) => req.status !== "resolved" && req.dueAt.getTime() < now.getTime());
    }
    if (params?.status) items = items.filter((req) => req.status === params.status);
    if (params?.principalId) items = items.filter((req) => req.principalId === params.principalId);
    if (params?.type) items = items.filter((req) => req.type === params.type);
    return paginate(items, params);
  }

  async updateDSRStatus(id: string, status: DSRStatus): Promise<DSRRequest> {
    const request = this.dsrRequests.get(id);
    if (!request) throw new Error(`Unknown DSR request: ${id}`);

    const updated: DSRRequest = {
      ...request,
      status,
      resolvedAt: status === "resolved" ? new Date() : request.resolvedAt,
    };
    this.dsrRequests.set(id, updated);
    if (status === "resolved") {
      await this.appendEntry({
        entryType: "dsr_resolved",
        refId: id,
        principalId: request.principalId,
        detail: { type: request.type },
      });
    }
    return updated;
  }

  // ─── LedgerRepository ────────────────────────────────────────────────────

  async appendEntry(input: AppendLedgerEntryInput): Promise<ConsentLedgerEntry> {
    const previousHash = this.lastHash;
    const partial = {
      id: randomUUID(),
      sequence: ++this.sequence,
      entryType: input.entryType,
      refId: input.refId,
      principalId: input.principalId,
      detail: input.detail,
      recordedAt: new Date(),
    };
    const hash = computeLedgerEntryHash(previousHash, partial);
    const entry: ConsentLedgerEntry = { ...partial, previousHash, hash };
    this.ledgerEntries.push(entry);
    this.lastHash = hash;
    return entry;
  }

  async listEntries(params?: ListLedgerEntriesParams): Promise<ConsentLedgerEntry[]> {
    let items = [...this.ledgerEntries];
    if (params?.principalId) items = items.filter((e) => e.principalId === params.principalId);
    if (params?.refId) items = items.filter((e) => e.refId === params.refId);
    if (params?.entryType) items = items.filter((e) => e.entryType === params.entryType);
    return paginate(items, params);
  }

  async createBreachEvent(input: CreateBreachEventInput): Promise<BreachEvent> {
    const event: BreachEvent = { id: randomUUID(), ...input, createdAt: new Date() };
    this.breachEvents.set(event.id, event);
    await this.appendEntry({
      entryType: "breach_logged",
      refId: event.id,
      detail: { severity: event.severity },
    });
    return event;
  }

  async listBreachEvents(params?: PageParams): Promise<BreachEvent[]> {
    return paginate([...this.breachEvents.values()], params);
  }

  async getComplianceSnapshot(dateRange: DateRange): Promise<ComplianceSnapshot> {
    const inRange = (date: Date) => date.getTime() >= dateRange.from.getTime() && date.getTime() <= dateRange.to.getTime();
    const consents = [...this.consentArtifacts.values()];
    const dsrs = [...this.dsrRequests.values()];
    const now = new Date();

    return {
      dateRange,
      consentsGranted: consents.filter((c) => inRange(c.grantedAt)).length,
      consentsWithdrawn: consents.filter((c) => c.withdrawnAt && inRange(c.withdrawnAt)).length,
      consentsExpired: consents.filter((c) => c.status === "expired" && inRange(c.expiresAt)).length,
      dsrOpen: dsrs.filter((req) => req.status === "open" || req.status === "in_progress").length,
      dsrOverdue: dsrs.filter((req) => req.status !== "resolved" && req.dueAt.getTime() < now.getTime()).length,
      dsrResolved: dsrs.filter((req) => req.status === "resolved" && req.resolvedAt && inRange(req.resolvedAt)).length,
      breachesLogged: [...this.breachEvents.values()].filter((b) => inRange(b.detectedAt)).length,
    };
  }

  async verifyLedgerIntegrity(dateRange?: DateRange, verifyFullChain = false): Promise<LedgerIntegrityReport> {
    // Sorted by sequence (not recordedAt/timestamp) — true write order is
    // what the chain follows, and the two aren't guaranteed to agree if
    // the system clock wasn't monotonic.
    const ordered = [...this.ledgerEntries].sort((a, b) => a.sequence - b.sequence);

    // Only trust the cached checkpoint if an entry with that exact
    // sequence+hash still exists — if the store was reseeded or mutated
    // out-of-band since the last check, self-heal by falling back to a
    // full walk instead of verifying from a checkpoint that no longer
    // reflects reality.
    let checkpoint: { sequence: number; hash: string } | null = null;
    if (!verifyFullChain && this.lastVerifiedCheckpoint) {
      const stillValid = ordered.some(
        (e) => e.sequence === this.lastVerifiedCheckpoint!.sequence && e.hash === this.lastVerifiedCheckpoint!.hash,
      );
      checkpoint = stillValid ? this.lastVerifiedCheckpoint : null;
    }

    const toVerify = checkpoint ? ordered.filter((e) => e.sequence > checkpoint!.sequence) : ordered;
    const startingHash = checkpoint?.hash ?? LEDGER_GENESIS_HASH;
    const result = verifyChain(toVerify, startingHash);

    if (result.intact && toVerify.length > 0) {
      const last = toVerify[toVerify.length - 1]!;
      this.lastVerifiedCheckpoint = { sequence: last.sequence, hash: last.hash };
    }

    const entriesChecked = dateRange
      ? toVerify.filter(
          (e) => e.recordedAt.getTime() >= dateRange.from.getTime() && e.recordedAt.getTime() <= dateRange.to.getTime(),
        ).length
      : toVerify.length;

    return { intact: result.intact, entriesChecked, verifiedFullChain: !checkpoint, firstBreak: result.firstBreak };
  }
}
