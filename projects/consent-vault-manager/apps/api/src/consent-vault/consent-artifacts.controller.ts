import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";

import type { ConsentStatus } from "../../../../mock-store/types";
import { CreateConsentArtifactDto } from "./dto/create-consent-artifact.dto";
import { RevokeConsentDto } from "./dto/revoke-consent.dto";
import { PrismaConsentRepository } from "./prisma-consent.repository";

@Controller("consent-artifacts")
export class ConsentArtifactsController {
  constructor(private readonly consentRepository: PrismaConsentRepository) {}

  @Get()
  list(
    @Query("principalId") principalId?: string,
    @Query("purposeId") purposeId?: string,
    @Query("status") status?: ConsentStatus,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.consentRepository.listConsentArtifacts({
      principalId,
      purposeId,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const artifact = await this.consentRepository.findConsentArtifactById(id);
    if (!artifact) throw new NotFoundException(`Unknown consent artifact: ${id}`);
    return artifact;
  }

  @Post()
  async create(@Body() dto: CreateConsentArtifactDto) {
    try {
      return await this.consentRepository.createConsentArtifact(dto);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
  }

  /** Domain action, not a generic PATCH — mirrors the revoke_consent MCP tool's shape. */
  @Post(":id/revoke")
  async revoke(@Param("id") id: string, @Body() dto: RevokeConsentDto) {
    try {
      return await this.consentRepository.revokeConsentArtifact(id, dto.reason);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
  }
}
