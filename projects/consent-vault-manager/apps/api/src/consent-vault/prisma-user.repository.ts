import { Injectable } from "@nestjs/common";

import type { CreateUserInput, PageParams, UserRepository } from "../../../../mock-store/repositories";
import type { Role, User } from "../../../../mock-store/types";
import { toDomainUser } from "./mappers";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Postgres-backed UserRepository (Phase 8). Mirrors
 * InMemoryConsentVaultStore's UserRepository methods exactly — see
 * mock-store/store.ts for the reference implementation.
 */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const fiduciary = await this.prisma.dataFiduciary.findUnique({ where: { id: input.fiduciaryId } });
    if (!fiduciary) throw new Error(`Unknown fiduciary: ${input.fiduciaryId}`);
    const existing = await this.findUserByUsername(input.username);
    if (existing) throw new Error(`Username "${input.username}" is already taken.`);

    const row = await this.prisma.user.create({ data: input });
    return toDomainUser(row);
  }

  async findUserByUsername(username: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { username } });
    return row ? toDomainUser(row) : null;
  }

  async findUserById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toDomainUser(row) : null;
  }

  async listUsers(fiduciaryId: string, params?: PageParams): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: { fiduciaryId },
      orderBy: { createdAt: "asc" },
      take: params?.limit,
      skip: params?.offset,
    });
    return rows.map(toDomainUser);
  }

  async updateUserRole(id: string, role: Role): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error(`Unknown user: ${id}`);
    const row = await this.prisma.user.update({ where: { id }, data: { role } });
    return toDomainUser(row);
  }
}
