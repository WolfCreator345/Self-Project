import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type {
  AppendLedgerEntryInput,
  ComplianceSnapshot,
  CreateBreachEventInput,
  DateRange,
  LedgerRepository,
  ListLedgerEntriesParams,
  PageParams,
} from "../../../../mock-store/repositories";
import type { BreachEvent, ConsentLedgerEntry } from "../../../../mock-store/types";
import { toDomainBreachEvent, toDomainLedgerEntry } from "./mappers";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PrismaLedgerRepository implements LedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async appendEntry(input: AppendLedgerEntryInput): Promise<ConsentLedgerEntry> {
    const row = await this.prisma.consentLedgerEntry.create({
      data: {
        entryType: input.entryType,
        refId: input.refId,
        principalId: input.principalId ?? null,
        detail: input.detail as Prisma.InputJsonValue,
      },
    });
    return toDomainLedgerEntry(row);
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
}
