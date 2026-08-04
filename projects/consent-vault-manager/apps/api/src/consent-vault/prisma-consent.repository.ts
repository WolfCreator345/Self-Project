import { Injectable } from "@nestjs/common";

import type {
  ConsentRepository,
  CreateConsentArtifactInput,
  CreatePrincipalInput,
  CreatePurposeInput,
  ListConsentArtifactsParams,
  ListProcessorsParams,
  PageParams,
} from "../../../../mock-store/repositories";
import type { ConsentArtifact, DataFiduciary, DataPrincipal, Processor, Purpose } from "../../../../mock-store/types";
import {
  toDomainConsentArtifact,
  toDomainFiduciary,
  toDomainPrincipal,
  toDomainProcessor,
  toDomainPurpose,
} from "./mappers";
import { addDays } from "./date-utils";
import { PrismaLedgerRepository } from "./prisma-ledger.repository";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Postgres-backed ConsentRepository. Mirrors InMemoryConsentVaultStore's
 * business logic exactly (same validation, same expiresAt computation, same
 * self-logging via LedgerRepository) — mock-store/store.ts is the reference
 * implementation this must stay behaviorally identical to.
 *
 * Not wrapped in $transaction: each mutation does its read/write against
 * Postgres and then calls PrismaLedgerRepository.appendEntry as a second,
 * separate statement — same sequencing the mock does, just without the
 * implicit atomicity JS's single-threadedness gave it there. Fine for this
 * phase's demo/test scope; production hardening would wrap each of these in
 * prisma.$transaction.
 */
@Injectable()
export class PrismaConsentRepository implements ConsentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: PrismaLedgerRepository,
  ) {}

  /** The platform's primary/first-seeded fiduciary — see mock-store's ConsentRepository.getFiduciary() doc comment. */
  async getFiduciary(): Promise<DataFiduciary> {
    const row = await this.prisma.dataFiduciary.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    return toDomainFiduciary(row);
  }

  async findFiduciaryById(id: string): Promise<DataFiduciary | null> {
    const row = await this.prisma.dataFiduciary.findUnique({ where: { id } });
    return row ? toDomainFiduciary(row) : null;
  }

  async listFiduciaries(): Promise<DataFiduciary[]> {
    const rows = await this.prisma.dataFiduciary.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomainFiduciary);
  }

  async listPrincipals(params?: PageParams & { fiduciaryId?: string }): Promise<DataPrincipal[]> {
    const rows = await this.prisma.dataPrincipal.findMany({
      where: { fiduciaryId: params?.fiduciaryId },
      orderBy: { createdAt: "asc" },
      take: params?.limit,
      skip: params?.offset,
    });
    return rows.map(toDomainPrincipal);
  }

  async findPrincipalById(id: string): Promise<DataPrincipal | null> {
    const row = await this.prisma.dataPrincipal.findUnique({ where: { id } });
    return row ? toDomainPrincipal(row) : null;
  }

  async createPrincipal(input: CreatePrincipalInput): Promise<DataPrincipal> {
    const row = await this.prisma.dataPrincipal.create({ data: input });
    return toDomainPrincipal(row);
  }

  async listPurposes(params?: PageParams & { fiduciaryId?: string }): Promise<Purpose[]> {
    const rows = await this.prisma.purpose.findMany({
      where: { fiduciaryId: params?.fiduciaryId },
      orderBy: { createdAt: "asc" },
      take: params?.limit,
      skip: params?.offset,
    });
    return rows.map(toDomainPurpose);
  }

  async findPurposeById(id: string): Promise<Purpose | null> {
    const row = await this.prisma.purpose.findUnique({ where: { id } });
    return row ? toDomainPurpose(row) : null;
  }

  async createPurpose(input: CreatePurposeInput): Promise<Purpose> {
    const row = await this.prisma.purpose.create({ data: input });
    return toDomainPurpose(row);
  }

  async createConsentArtifact(input: CreateConsentArtifactInput): Promise<ConsentArtifact> {
    const principal = await this.prisma.dataPrincipal.findUnique({ where: { id: input.principalId } });
    if (!principal) throw new Error(`Unknown principal: ${input.principalId}`);
    const purpose = await this.prisma.purpose.findUnique({ where: { id: input.purposeId } });
    if (!purpose) throw new Error(`Unknown purpose: ${input.purposeId}`);
    if (purpose.lawfulBasis !== "consent") {
      throw new Error(
        `Purpose "${purpose.id}" is processed under "${purpose.lawfulBasis}" — consent cannot be recorded as its basis.`,
      );
    }
    // Tenant integrity (Phase 8): mirrors mock-store/store.ts's check — a
    // consent artifact can't straddle two fiduciaries.
    if (principal.fiduciaryId !== purpose.fiduciaryId) {
      throw new Error(
        `Principal "${principal.id}" (fiduciary ${principal.fiduciaryId}) and purpose "${purpose.id}" (fiduciary ${purpose.fiduciaryId}) belong to different fiduciaries.`,
      );
    }

    const now = new Date();
    const row = await this.prisma.consentArtifact.create({
      data: {
        fiduciaryId: purpose.fiduciaryId,
        principalId: input.principalId,
        purposeId: input.purposeId,
        status: "granted",
        grantedAt: now,
        expiresAt: addDays(now, purpose.retentionPeriodDays),
        noticeVersion: input.noticeVersion,
        language: input.language,
      },
    });
    const artifact = toDomainConsentArtifact(row);
    await this.ledger.appendEntry({
      entryType: "consent_granted",
      refId: artifact.id,
      principalId: artifact.principalId,
      detail: { purposeId: artifact.purposeId, noticeVersion: artifact.noticeVersion },
    });
    return artifact;
  }

  async revokeConsentArtifact(id: string, reason: string): Promise<ConsentArtifact> {
    const existing = await this.prisma.consentArtifact.findUnique({ where: { id } });
    if (!existing) throw new Error(`Unknown consent artifact: ${id}`);
    if (existing.status !== "granted") {
      throw new Error(`Cannot revoke consent artifact "${id}" from status "${existing.status}"`);
    }

    const row = await this.prisma.consentArtifact.update({
      where: { id },
      data: { status: "withdrawn", withdrawnAt: new Date() },
    });
    const artifact = toDomainConsentArtifact(row);
    await this.ledger.appendEntry({
      entryType: "consent_withdrawn",
      refId: id,
      principalId: artifact.principalId,
      detail: { purposeId: artifact.purposeId, reason },
    });
    return artifact;
  }

  async markExpired(id: string): Promise<ConsentArtifact> {
    const existing = await this.prisma.consentArtifact.findUnique({ where: { id } });
    if (!existing) throw new Error(`Unknown consent artifact: ${id}`);

    const previousStatus = existing.status;
    const row = await this.prisma.consentArtifact.update({ where: { id }, data: { status: "expired" } });
    const artifact = toDomainConsentArtifact(row);
    await this.ledger.appendEntry({
      entryType: "consent_expired",
      refId: id,
      principalId: artifact.principalId,
      detail: {
        purposeId: artifact.purposeId,
        previousStatus,
        newStatus: artifact.status,
        changedAt: artifact.updatedAt.toISOString(),
      },
    });
    return artifact;
  }

  async findConsentArtifact(principalId: string, purposeId: string): Promise<ConsentArtifact | null> {
    const row = await this.prisma.consentArtifact.findFirst({
      where: { principalId, purposeId },
      orderBy: { createdAt: "desc" },
    });
    return row ? toDomainConsentArtifact(row) : null;
  }

  async findConsentArtifactById(id: string): Promise<ConsentArtifact | null> {
    const row = await this.prisma.consentArtifact.findUnique({ where: { id } });
    return row ? toDomainConsentArtifact(row) : null;
  }

  async listConsentArtifacts(params?: ListConsentArtifactsParams): Promise<ConsentArtifact[]> {
    const rows = await this.prisma.consentArtifact.findMany({
      where: {
        principalId: params?.principalId,
        purposeId: params?.purposeId,
        status: params?.status,
        fiduciaryId: params?.fiduciaryId,
      },
      orderBy: { createdAt: "asc" },
      take: params?.limit,
      skip: params?.offset,
    });
    return rows.map(toDomainConsentArtifact);
  }

  async listProcessors(params?: ListProcessorsParams): Promise<Processor[]> {
    const rows = await this.prisma.processor.findMany({
      where: {
        purposeId: params?.purposeId,
        status: params?.status,
      },
      orderBy: { createdAt: "asc" },
      take: params?.limit,
      skip: params?.offset,
    });
    return rows.map(toDomainProcessor);
  }

  async markProcessorForPurge(id: string, reason: string): Promise<Processor> {
    const existing = await this.prisma.processor.findUnique({ where: { id } });
    if (!existing) throw new Error(`Unknown processor: ${id}`);

    const row = await this.prisma.processor.update({ where: { id }, data: { status: "purge_pending" } });
    const processor = toDomainProcessor(row);
    await this.ledger.appendEntry({
      entryType: "processor_purge_flagged",
      refId: id,
      detail: { purposeId: processor.purposeId, processorName: processor.name, reason },
    });
    return processor;
  }
}
