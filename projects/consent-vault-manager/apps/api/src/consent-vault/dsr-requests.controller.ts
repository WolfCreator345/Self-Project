import { Controller, Get, Query } from "@nestjs/common";

import type { DSRStatus, DSRType } from "../../../../mock-store/types";
import { PrismaDSRRepository } from "./prisma-dsr.repository";

/** Backs the dashboard's DSR queue view. */
@Controller("dsr-requests")
export class DSRRequestsController {
  constructor(private readonly dsrRepository: PrismaDSRRepository) {}

  @Get()
  async list(
    @Query("type") type?: DSRType,
    @Query("status") status?: DSRStatus,
    @Query("overdueOnly") overdueOnly?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const requests = await this.dsrRepository.listDSRRequests({
      type,
      status,
      overdueOnly: overdueOnly === "true",
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    // Sorted here rather than in the repository — dueAt-ascending is what
    // this dashboard view needs, but changing listDSRRequests' own default
    // order (createdAt-ascending) could break other callers (MCP tool,
    // existing tests) that rely on it.
    return [...requests].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }
}
