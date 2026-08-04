import { Controller, Get, NotFoundException, Param, Post, Body, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import { Roles } from "../auth/roles.decorator";
import { CreatePurposeDto } from "./dto/create-purpose.dto";
import { PrismaConsentRepository } from "./prisma-consent.repository";

@Controller("purposes")
export class PurposesController {
  constructor(private readonly consentRepository: PrismaConsentRepository) {}

  @Get()
  list(@Req() req: Request, @Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.consentRepository.listPurposes({
      fiduciaryId: req.session.fiduciaryId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() req: Request) {
    const purpose = await this.consentRepository.findPurposeById(id);
    if (!purpose || purpose.fiduciaryId !== req.session.fiduciaryId) {
      throw new NotFoundException(`Unknown purpose: ${id}`);
    }
    return purpose;
  }

  @Post()
  @Roles("admin", "dpo")
  create(@Body() dto: CreatePurposeDto, @Req() req: Request) {
    return this.consentRepository.createPurpose({ ...dto, fiduciaryId: req.session.fiduciaryId! });
  }
}
