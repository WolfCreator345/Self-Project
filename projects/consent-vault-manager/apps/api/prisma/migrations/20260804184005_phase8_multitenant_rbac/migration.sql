-- Phase 8: multi-tenant + RBAC.
--
-- fiduciaryId is added nullable first, backfilled, then tightened to NOT
-- NULL in this same migration (rather than three separate migrations like
-- Phase 5's hash-chain rollout) — the backfill here is a flat constant
-- assignment, not a per-row computation, so it doesn't need a separate
-- TypeScript backfill script the way hash-chaining did. Every pre-Phase-8
-- row unambiguously belonged to the one fiduciary that existed before this
-- migration ('fiduciary-1', the seed's literal id — see
-- mock-store/seed.ts), so backfilling to that id is always correct, not a
-- guess.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'dpo', 'viewer');

-- CreateTable (brand new table, safe to create NOT NULL columns directly)
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fiduciaryId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_fiduciaryId_idx" ON "users"("fiduciaryId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_fiduciaryId_fkey" FOREIGN KEY ("fiduciaryId") REFERENCES "data_fiduciaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Expand: add fiduciaryId nullable to every existing table.
ALTER TABLE "data_principals" ADD COLUMN "fiduciaryId" TEXT;
ALTER TABLE "purposes" ADD COLUMN "fiduciaryId" TEXT;
ALTER TABLE "consent_artifacts" ADD COLUMN "fiduciaryId" TEXT;
ALTER TABLE "dsr_requests" ADD COLUMN "fiduciaryId" TEXT;
ALTER TABLE "breach_events" ADD COLUMN "fiduciaryId" TEXT;
ALTER TABLE "processors" ADD COLUMN "fiduciaryId" TEXT;

-- Backfill: every row that existed before Phase 8 belonged to the one
-- fiduciary that existed before Phase 8.
UPDATE "data_principals" SET "fiduciaryId" = 'fiduciary-1' WHERE "fiduciaryId" IS NULL;
UPDATE "purposes" SET "fiduciaryId" = 'fiduciary-1' WHERE "fiduciaryId" IS NULL;
UPDATE "consent_artifacts" SET "fiduciaryId" = 'fiduciary-1' WHERE "fiduciaryId" IS NULL;
UPDATE "dsr_requests" SET "fiduciaryId" = 'fiduciary-1' WHERE "fiduciaryId" IS NULL;
UPDATE "breach_events" SET "fiduciaryId" = 'fiduciary-1' WHERE "fiduciaryId" IS NULL;
UPDATE "processors" SET "fiduciaryId" = 'fiduciary-1' WHERE "fiduciaryId" IS NULL;

-- Contract: tighten to NOT NULL now that every row has a value.
ALTER TABLE "data_principals" ALTER COLUMN "fiduciaryId" SET NOT NULL;
ALTER TABLE "purposes" ALTER COLUMN "fiduciaryId" SET NOT NULL;
ALTER TABLE "consent_artifacts" ALTER COLUMN "fiduciaryId" SET NOT NULL;
ALTER TABLE "dsr_requests" ALTER COLUMN "fiduciaryId" SET NOT NULL;
ALTER TABLE "breach_events" ALTER COLUMN "fiduciaryId" SET NOT NULL;
ALTER TABLE "processors" ALTER COLUMN "fiduciaryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "data_principals_fiduciaryId_idx" ON "data_principals"("fiduciaryId");
CREATE INDEX "purposes_fiduciaryId_idx" ON "purposes"("fiduciaryId");
CREATE INDEX "consent_artifacts_fiduciaryId_idx" ON "consent_artifacts"("fiduciaryId");
CREATE INDEX "dsr_requests_fiduciaryId_idx" ON "dsr_requests"("fiduciaryId");
CREATE INDEX "breach_events_fiduciaryId_idx" ON "breach_events"("fiduciaryId");
CREATE INDEX "processors_fiduciaryId_idx" ON "processors"("fiduciaryId");

-- AddForeignKey
ALTER TABLE "data_principals" ADD CONSTRAINT "data_principals_fiduciaryId_fkey" FOREIGN KEY ("fiduciaryId") REFERENCES "data_fiduciaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purposes" ADD CONSTRAINT "purposes_fiduciaryId_fkey" FOREIGN KEY ("fiduciaryId") REFERENCES "data_fiduciaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_artifacts" ADD CONSTRAINT "consent_artifacts_fiduciaryId_fkey" FOREIGN KEY ("fiduciaryId") REFERENCES "data_fiduciaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dsr_requests" ADD CONSTRAINT "dsr_requests_fiduciaryId_fkey" FOREIGN KEY ("fiduciaryId") REFERENCES "data_fiduciaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "breach_events" ADD CONSTRAINT "breach_events_fiduciaryId_fkey" FOREIGN KEY ("fiduciaryId") REFERENCES "data_fiduciaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "processors" ADD CONSTRAINT "processors_fiduciaryId_fkey" FOREIGN KEY ("fiduciaryId") REFERENCES "data_fiduciaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
