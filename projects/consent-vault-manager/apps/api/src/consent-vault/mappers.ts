/**
 * Prisma model -> mock-store domain type mappers. The Prisma schema mirrors
 * mock-store/types.ts field-for-field (see prisma/schema.prisma's header
 * comment), so these are mostly pass-through — the only real work is
 * null -> undefined (Prisma's nullable columns vs. our optional properties)
 * and casting the untyped Json `detail` column to Record<string, unknown>.
 */

import type {
  BreachEvent as PrismaBreachEvent,
  ConsentArtifact as PrismaConsentArtifact,
  ConsentLedgerEntry as PrismaConsentLedgerEntry,
  DataFiduciary as PrismaDataFiduciary,
  DataPrincipal as PrismaDataPrincipal,
  DSRRequest as PrismaDSRRequest,
  Processor as PrismaProcessor,
  Purpose as PrismaPurpose,
} from "@prisma/client";

import type {
  BreachEvent,
  ConsentArtifact,
  ConsentLedgerEntry,
  DataFiduciary,
  DataPrincipal,
  DSRRequest,
  Processor,
  Purpose,
} from "../../../../mock-store/types";

export function toDomainFiduciary(row: PrismaDataFiduciary): DataFiduciary {
  return { id: row.id, name: row.name, dpoName: row.dpoName, dpoEmail: row.dpoEmail, createdAt: row.createdAt };
}

export function toDomainPrincipal(row: PrismaDataPrincipal): DataPrincipal {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    isMinor: row.isMinor,
    guardianName: row.guardianName ?? undefined,
    guardianEmail: row.guardianEmail ?? undefined,
    createdAt: row.createdAt,
  };
}

export function toDomainPurpose(row: PrismaPurpose): Purpose {
  return {
    id: row.id,
    description: row.description,
    lawfulBasis: row.lawfulBasis,
    retentionPeriodDays: row.retentionPeriodDays,
    createdAt: row.createdAt,
  };
}

export function toDomainConsentArtifact(row: PrismaConsentArtifact): ConsentArtifact {
  return {
    id: row.id,
    principalId: row.principalId,
    purposeId: row.purposeId,
    status: row.status,
    grantedAt: row.grantedAt,
    withdrawnAt: row.withdrawnAt ?? undefined,
    expiresAt: row.expiresAt,
    noticeVersion: row.noticeVersion,
    language: row.language,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDomainLedgerEntry(row: PrismaConsentLedgerEntry): ConsentLedgerEntry {
  return {
    id: row.id,
    sequence: row.sequence,
    entryType: row.entryType,
    refId: row.refId,
    principalId: row.principalId ?? undefined,
    detail: (row.detail ?? {}) as Record<string, unknown>,
    recordedAt: row.recordedAt,
  };
}

export function toDomainDSRRequest(row: PrismaDSRRequest): DSRRequest {
  return {
    id: row.id,
    principalId: row.principalId,
    type: row.type,
    submittedAt: row.submittedAt,
    dueAt: row.dueAt,
    status: row.status,
    resolvedAt: row.resolvedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

export function toDomainBreachEvent(row: PrismaBreachEvent): BreachEvent {
  return {
    id: row.id,
    description: row.description,
    detectedAt: row.detectedAt,
    dpbNotifyDueAt: row.dpbNotifyDueAt,
    severity: row.severity,
    createdAt: row.createdAt,
  };
}

export function toDomainProcessor(row: PrismaProcessor): Processor {
  return {
    id: row.id,
    name: row.name,
    purposeId: row.purposeId,
    status: row.status,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
