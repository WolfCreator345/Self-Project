import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type {
  CreateDSRRequestInput,
  DSRRepository,
  ListDSRRequestsParams,
} from "../../../../mock-store/repositories";
import type { DSRRequest, DSRStatus } from "../../../../mock-store/types";
import { addDays } from "./date-utils";
import { toDomainDSRRequest } from "./mappers";
import { PrismaLedgerRepository } from "./prisma-ledger.repository";
import { PrismaService } from "../prisma/prisma.service";

/** Data Subject Rights response SLA, matching mock-store/store.ts's DSR_SLA_DAYS. */
const DSR_SLA_DAYS = 30;

@Injectable()
export class PrismaDSRRepository implements DSRRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: PrismaLedgerRepository,
  ) {}

  async createDSRRequest(input: CreateDSRRequestInput): Promise<DSRRequest> {
    const principal = await this.prisma.dataPrincipal.findUnique({ where: { id: input.principalId } });
    if (!principal) throw new Error(`Unknown principal: ${input.principalId}`);

    const now = new Date();
    const row = await this.prisma.dSRRequest.create({
      data: {
        fiduciaryId: principal.fiduciaryId,
        principalId: input.principalId,
        type: input.type,
        submittedAt: now,
        dueAt: addDays(now, DSR_SLA_DAYS),
        status: "open",
      },
    });
    const request = toDomainDSRRequest(row);
    await this.ledger.appendEntry({
      entryType: "dsr_created",
      refId: request.id,
      principalId: request.principalId,
      detail: { type: request.type },
    });
    return request;
  }

  async findDSRRequestById(id: string): Promise<DSRRequest | null> {
    const row = await this.prisma.dSRRequest.findUnique({ where: { id } });
    return row ? toDomainDSRRequest(row) : null;
  }

  async listDSRRequests(params?: ListDSRRequestsParams): Promise<DSRRequest[]> {
    // Built as independent AND conditions (rather than a single object with
    // possibly-colliding keys) so overdueOnly and an explicit status filter
    // combine correctly if both are given, mirroring the mock's sequential
    // .filter() chain instead of one overwriting the other.
    const AND: Prisma.DSRRequestWhereInput[] = [];
    if (params?.principalId) AND.push({ principalId: params.principalId });
    if (params?.overdueOnly) AND.push({ status: { not: "resolved" }, dueAt: { lt: new Date() } });
    if (params?.status) AND.push({ status: params.status });
    if (params?.type) AND.push({ type: params.type });
    if (params?.fiduciaryId) AND.push({ fiduciaryId: params.fiduciaryId });

    const rows = await this.prisma.dSRRequest.findMany({
      where: AND.length > 0 ? { AND } : undefined,
      orderBy: { createdAt: "asc" },
      take: params?.limit,
      skip: params?.offset,
    });
    return rows.map(toDomainDSRRequest);
  }

  async updateDSRStatus(id: string, status: DSRStatus): Promise<DSRRequest> {
    const existing = await this.prisma.dSRRequest.findUnique({ where: { id } });
    if (!existing) throw new Error(`Unknown DSR request: ${id}`);

    const row = await this.prisma.dSRRequest.update({
      where: { id },
      data: { status, resolvedAt: status === "resolved" ? new Date() : existing.resolvedAt },
    });
    const request = toDomainDSRRequest(row);
    if (status === "resolved") {
      await this.ledger.appendEntry({
        entryType: "dsr_resolved",
        refId: id,
        principalId: request.principalId,
        detail: { type: request.type },
      });
    }
    return request;
  }
}
