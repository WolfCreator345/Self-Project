import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import type { ConsentStatus } from "../../../../mock-store/types";
import { Roles } from "../auth/roles.decorator";
import { CreateConsentArtifactDto } from "./dto/create-consent-artifact.dto";
import { RevokeConsentDto } from "./dto/revoke-consent.dto";
import { PrismaConsentRepository } from "./prisma-consent.repository";
import { PrismaLedgerRepository } from "./prisma-ledger.repository";

@Controller("consent-artifacts")
export class ConsentArtifactsController {
  constructor(
    private readonly consentRepository: PrismaConsentRepository,
    private readonly ledgerRepository: PrismaLedgerRepository,
  ) {}

  @Get()
  list(
    @Req() req: Request,
    @Query("principalId") principalId?: string,
    @Query("purposeId") purposeId?: string,
    @Query("status") status?: ConsentStatus,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.consentRepository.listConsentArtifacts({
      fiduciaryId: req.session.fiduciaryId,
      principalId,
      purposeId,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() req: Request) {
    const artifact = await this.consentRepository.findConsentArtifactById(id);
    if (!artifact || artifact.fiduciaryId !== req.session.fiduciaryId) {
      throw new NotFoundException(`Unknown consent artifact: ${id}`);
    }
    return artifact;
  }

  @Post()
  @Roles("admin", "dpo")
  async create(@Body() dto: CreateConsentArtifactDto, @Req() req: Request) {
    // Defense in depth: createConsentArtifact already rejects a principal
    // and purpose that disagree with each other about which fiduciary they
    // belong to (Phase 8), but says nothing about whether either belongs to
    // *this caller's* fiduciary — a DPO could otherwise target another
    // tenant's principal/purpose pair just by knowing (or guessing) their
    // ids, since those two would still agree with each other. Checking the
    // principal against the session here closes that gap; createConsentArtifact's
    // own principal/purpose agreement check covers the rest.
    const principal = await this.consentRepository.findPrincipalById(dto.principalId);
    if (!principal || principal.fiduciaryId !== req.session.fiduciaryId) {
      throw new NotFoundException(`Unknown principal: ${dto.principalId}`);
    }
    try {
      return await this.consentRepository.createConsentArtifact(dto);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
  }

  /** Domain action, not a generic PATCH — mirrors the revoke_consent MCP tool's shape. */
  @Post(":id/revoke")
  @Roles("admin", "dpo")
  async revoke(@Param("id") id: string, @Body() dto: RevokeConsentDto, @Req() req: Request) {
    const existing = await this.consentRepository.findConsentArtifactById(id);
    if (!existing || existing.fiduciaryId !== req.session.fiduciaryId) {
      throw new NotFoundException(`Unknown consent artifact: ${id}`);
    }
    try {
      return await this.consentRepository.revokeConsentArtifact(id, dto.reason);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
  }

  /** Backs the dashboard's "click a row to see its ledger history" consent-status view. */
  @Get(":id/ledger")
  async ledger(@Param("id") id: string, @Req() req: Request) {
    const artifact = await this.consentRepository.findConsentArtifactById(id);
    if (!artifact || artifact.fiduciaryId !== req.session.fiduciaryId) {
      throw new NotFoundException(`Unknown consent artifact: ${id}`);
    }
    return this.ledgerRepository.listEntries({ refId: id });
  }
}
