import { Controller, Get, NotFoundException, Param, Post, Body, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import { Roles } from "../auth/roles.decorator";
import { CreatePrincipalDto } from "./dto/create-principal.dto";
import { PrismaConsentRepository } from "./prisma-consent.repository";

@Controller("principals")
export class PrincipalsController {
  constructor(private readonly consentRepository: PrismaConsentRepository) {}

  @Get()
  list(@Req() req: Request, @Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.consentRepository.listPrincipals({
      fiduciaryId: req.session.fiduciaryId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() req: Request) {
    const principal = await this.consentRepository.findPrincipalById(id);
    // 404, not 403, for a principal that exists but belongs to another
    // fiduciary — same reasoning as UsersController.updateRole.
    if (!principal || principal.fiduciaryId !== req.session.fiduciaryId) {
      throw new NotFoundException(`Unknown principal: ${id}`);
    }
    return principal;
  }

  @Post()
  @Roles("admin", "dpo")
  create(@Body() dto: CreatePrincipalDto, @Req() req: Request) {
    return this.consentRepository.createPrincipal({ ...dto, fiduciaryId: req.session.fiduciaryId! });
  }
}
