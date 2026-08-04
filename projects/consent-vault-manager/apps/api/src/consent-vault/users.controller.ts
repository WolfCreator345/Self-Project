import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Put, Req } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { Request } from "express";

import { Roles } from "../auth/roles.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { PrismaUserRepository } from "./prisma-user.repository";

const BCRYPT_ROUNDS = 10;

/**
 * Phase 8: user (team) management, admin-only within the caller's own
 * fiduciary — see mock-store/types.ts's Role doc comment for why this is
 * the one thing DPO can't do that Admin can. fiduciaryId is never taken as
 * request input, for either creating or targeting a user: it's always the
 * caller's own session fiduciaryId, so an admin can only ever manage their
 * own tenant's team, never reach into another one by guessing an id.
 */
@Controller("users")
@Roles("admin")
export class UsersController {
  constructor(private readonly userRepository: PrismaUserRepository) {}

  @Get()
  async list(@Req() req: Request) {
    const users = await this.userRepository.listUsers(req.session.fiduciaryId!);
    return users.map(toSafeUser);
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: Request) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.userRepository.createUser({
      fiduciaryId: req.session.fiduciaryId!,
      username: dto.username,
      passwordHash,
      role: dto.role,
    });
    return toSafeUser(user);
  }

  @Put(":id/role")
  async updateRole(@Param("id") id: string, @Body() dto: UpdateUserRoleDto, @Req() req: Request) {
    const existing = await this.userRepository.findUserById(id);
    // 404, not 403, if the id belongs to another fiduciary entirely — an
    // admin shouldn't be able to tell the difference between "no such user"
    // and "that user exists, but isn't yours" from the response.
    if (!existing || existing.fiduciaryId !== req.session.fiduciaryId) {
      throw new NotFoundException(`Unknown user: ${id}`);
    }
    if (existing.id === req.session.userId && dto.role !== "admin") {
      throw new ForbiddenException("You can't demote your own account — have another admin do it.");
    }
    const updated = await this.userRepository.updateUserRole(id, dto.role);
    return toSafeUser(updated);
  }
}

/** Never send passwordHash to the client, even hashed. */
function toSafeUser(user: { id: string; fiduciaryId: string; username: string; role: string; createdAt: Date }) {
  const { id, fiduciaryId, username, role, createdAt } = user;
  return { id, fiduciaryId, username, role, createdAt };
}
