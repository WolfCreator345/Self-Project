import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type {
  AppendLedgerEntryInput,
  ComplianceSnapshot,
  CreateBreachEventInput,
  DateRange,
  LedgerIntegrityReport,
  LedgerRepository,
  ListLedgerEntriesParams,
  PageParams,
} from "../../../../mock-store/repositories";
import type { BreachEvent, ConsentLedgerEntry } from "../../../../mock-store/types";
import { computeLedgerEntryHash, LEDGER_GENESIS_HASH, PENDING_HASH_SENTINEL, verifyChain } from "./hash-chain";
import { toDomainBreachEvent, toDomainLedgerEntry } from "./mappers";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PrismaLedgerRepository implements LedgerRepository {
  /**
   * Last checkpoint verifyLedgerIntegrity successfully verified up to.
   * Instance-level, in-memory — fine because both this Nest app and the
   * manually-wired mcp-server/jobs process (see create-real-repositories.ts)
   * construct exactly one long-lived PrismaLedgerRepository per process,
   * mirroring mock-store/store.ts's InMemoryConsentVaultStore.
   */
  private lastVerifiedCheckpoint: { sequence: number; hash: string } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Not wrapped in $transaction (same tradeoff as PrismaConsentRepository/
   * PrismaDSRRepository — see their header comments): reads the latest
   * entry's hash, inserts the new row (Postgres assigns `sequence`, which
   * the hash computation needs and can't know ahead of the insert), then
   * updates that same row with the computed previousHash/hash. A
   * concurrent writer racing this read could produce two entries chained
   * from the same previousHash — acceptable for this phase's demo/test
   * scope, not for a real concurrent-write production system.
   */
  async appendEntry(input: AppendLedgerEntryInput): Promise<ConsentLedgerEntry> {
    const latest = await this.prisma.consentLedgerEntry.findFirst({ orderBy: { sequence: "desc" } });
    const previousHash = latest?.hash ?? LEDGER_GENESIS_HASH;

    // previousHash/hash are NOT NULL columns but the real hash can't be
    // computed until Postgres assigns `sequence` on insert — write the
    // pending sentinel, then immediately overwrite it below.
    const created = await this.prisma.consentLedgerEntry.create({
      data: {
        entryType: input.entryType,
        refId: input.refId,
        principalId: input.principalId ?? null,
        detail: input.detail as Prisma.InputJsonValue,
        previousHash: PENDING_HASH_SENTINEL,
        hash: PENDING_HASH_SENTINEL,
      },
    });

    const hash = computeLedgerEntryHash(previousHash, {
      id: created.id,
      sequence: created.sequence,
      entryType: created.entryType,
      refId: created.refId,
      principalId: created.principalId,
      detail: input.detail,
      recordedAt: created.recordedAt,
    });

    const updated = await this.prisma.consentLedgerEntry.update({
      where: { id: created.id },
      data: { previousHash, hash },
    });

    return toDomainLedgerEntry(updated);
  }

  async listEntries(params?: ListLedgerEntriesParams): Promise<ConsentLedgerEntry[]> {
    const rows = await this.prisma.consentLedgerEntry.findMany({
      where: {
        principalId: params?.principalId,
        refId: params?.refId,
        entryType: params?.entryType,
      },
      orderBy: { sequence: "asc" },
      take: params?.limit,
      skip: params?.offset,
    });
    return rows.map(toDomainLedgerEntry);
  }

  async createBreachEvent(input: CreateBreachEventInput): Promise<BreachEvent> {
    const row = await this.prisma.breachEvent.create({ data: input });
    const event = toDomainBreachEvent(row);
    await this.appendEntry({ entryType: "breach_logged", refId: event.id, detail: { severity: event.severity } });
    return event;
  }

  async listBreachEvents(params?: PageParams): Promise<BreachEvent[]> {
    const rows = await this.prisma.breachEvent.findMany({
      orderBy: { createdAt: "asc" },
      take: params?.limit,
      skip: params?.offset,
    });
    return rows.map(toDomainBreachEvent);
  }

  async findBreachEventById(id: string): Promise<BreachEvent | null> {
    const row = await this.prisma.breachEvent.findUnique({ where: { id } });
    return row ? toDomainBreachEvent(row) : null;
  }

  async getComplianceSnapshot(dateRange: DateRange): Promise<ComplianceSnapshot> {
    const { from, to } = dateRange;
    const now = new Date();

    const [consentsGranted, consentsWithdrawn, consentsExpired, dsrOpen, dsrOverdue, dsrResolved, breachesLogged] =
      await Promise.all([
        this.prisma.consentArtifact.count({ where: { grantedAt: { gte: from, lte: to } } }),
        this.prisma.consentArtifact.count({ where: { withdrawnAt: { gte: from, lte: to } } }),
        this.prisma.consentArtifact.count({ where: { status: "expired", expiresAt: { gte: from, lte: to } } }),
        this.prisma.dSRRequest.count({ where: { status: { in: ["open", "in_progress"] } } }),
        this.prisma.dSRRequest.count({ where: { status: { not: "resolved" }, dueAt: { lt: now } } }),
        this.prisma.dSRRequest.count({ where: { status: "resolved", resolvedAt: { gte: from, lte: to } } }),
        this.prisma.breachEvent.count({ where: { detectedAt: { gte: from, lte: to } } }),
      ]);

    return {
      dateRange,
      consentsGranted,
      consentsWithdrawn,
      consentsExpired,
      dsrOpen,
      dsrOverdue,
      dsrResolved,
      breachesLogged,
    };
  }

  async verifyLedgerIntegrity(dateRange?: DateRange, verifyFullChain = false): Promise<LedgerIntegrityReport> {
    // Only trust the cached checkpoint if a row with that exact
    // sequence+hash still exists in Postgres — if the table was reseeded or
    // mutated out-of-band since the last check, self-heal by falling back
    // to a full walk instead of verifying from a checkpoint that no longer
    // reflects the live data.
    let checkpoint: { sequence: number; hash: string } | null = null;
    if (!verifyFullChain && this.lastVerifiedCheckpoint) {
      const stillValid = await this.prisma.consentLedgerEntry.findFirst({
        where: { sequence: this.lastVerifiedCheckpoint.sequence, hash: this.lastVerifiedCheckpoint.hash },
      });
      checkpoint = stillValid ? this.lastVerifiedCheckpoint : null;
    }

    const rows = await this.prisma.consentLedgerEntry.findMany({
      where: checkpoint ? { sequence: { gt: checkpoint.sequence } } : undefined,
      orderBy: { sequence: "asc" },
    });
    const toVerify = rows.map(toDomainLedgerEntry);
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
