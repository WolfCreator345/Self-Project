import { Controller, Get, NotFoundException, Param, Post, Body, Query } from "@nestjs/common";

import { CreatePrincipalDto } from "./dto/create-principal.dto";
import { PrismaConsentRepository } from "./prisma-consent.repository";

@Controller("principals")
export class PrincipalsController {
  constructor(private readonly consentRepository: PrismaConsentRepository) {}

  @Get()
  list(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.consentRepository.listPrincipals({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const principal = await this.consentRepository.findPrincipalById(id);
    if (!principal) throw new NotFoundException(`Unknown principal: ${id}`);
    return principal;
  }

  @Post()
  create(@Body() dto: CreatePrincipalDto) {
    return this.consentRepository.createPrincipal(dto);
  }
}
