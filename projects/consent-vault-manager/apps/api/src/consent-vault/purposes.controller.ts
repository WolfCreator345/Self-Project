import { Controller, Get, NotFoundException, Param, Post, Body, Query } from "@nestjs/common";

import { CreatePurposeDto } from "./dto/create-purpose.dto";
import { PrismaConsentRepository } from "./prisma-consent.repository";

@Controller("purposes")
export class PurposesController {
  constructor(private readonly consentRepository: PrismaConsentRepository) {}

  @Get()
  list(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.consentRepository.listPurposes({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const purpose = await this.consentRepository.findPurposeById(id);
    if (!purpose) throw new NotFoundException(`Unknown purpose: ${id}`);
    return purpose;
  }

  @Post()
  create(@Body() dto: CreatePurposeDto) {
    return this.consentRepository.createPurpose(dto);
  }
}
