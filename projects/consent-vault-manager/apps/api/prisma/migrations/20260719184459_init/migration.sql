-- CreateEnum
CREATE TYPE "LawfulBasis" AS ENUM ('consent', 'legitimate_use');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('granted', 'withdrawn', 'expired');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('consent_granted', 'consent_withdrawn', 'consent_expired', 'dsr_created', 'dsr_resolved', 'breach_logged', 'processor_purge_flagged', 'renewal_email_drafted', 'purge_notice_email_drafted', 'purge_followup_event_scheduled');

-- CreateEnum
CREATE TYPE "DSRType" AS ENUM ('access', 'correction', 'erasure', 'nomination');

-- CreateEnum
CREATE TYPE "DSRStatus" AS ENUM ('open', 'in_progress', 'resolved', 'overdue');

-- CreateEnum
CREATE TYPE "BreachSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ProcessorStatus" AS ENUM ('active', 'purge_pending', 'purged');

-- CreateTable
CREATE TABLE "data_fiduciaries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dpoName" TEXT NOT NULL,
    "dpoEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_fiduciaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_principals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "guardianName" TEXT,
    "guardianEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_principals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purposes" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lawfulBasis" "LawfulBasis" NOT NULL,
    "retentionPeriodDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purposes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_artifacts" (
    "id" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_ledger_entries" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "refId" TEXT NOT NULL,
    "principalId" TEXT,
    "detail" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsr_requests" (
    "id" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "type" "DSRType" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "DSRStatus" NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dsr_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breach_events" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "dpbNotifyDueAt" TIMESTAMP(3) NOT NULL,
    "severity" "BreachSeverity" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breach_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "status" "ProcessorStatus" NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_artifacts_principalId_purposeId_idx" ON "consent_artifacts"("principalId", "purposeId");

-- CreateIndex
CREATE INDEX "consent_artifacts_status_idx" ON "consent_artifacts"("status");

-- CreateIndex
CREATE INDEX "consent_ledger_entries_refId_idx" ON "consent_ledger_entries"("refId");

-- CreateIndex
CREATE INDEX "consent_ledger_entries_principalId_idx" ON "consent_ledger_entries"("principalId");

-- CreateIndex
CREATE INDEX "consent_ledger_entries_entryType_idx" ON "consent_ledger_entries"("entryType");

-- CreateIndex
CREATE INDEX "dsr_requests_principalId_idx" ON "dsr_requests"("principalId");

-- CreateIndex
CREATE INDEX "dsr_requests_status_idx" ON "dsr_requests"("status");

-- CreateIndex
CREATE INDEX "processors_purposeId_idx" ON "processors"("purposeId");

-- AddForeignKey
ALTER TABLE "consent_artifacts" ADD CONSTRAINT "consent_artifacts_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "data_principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_artifacts" ADD CONSTRAINT "consent_artifacts_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "purposes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsr_requests" ADD CONSTRAINT "dsr_requests_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "data_principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processors" ADD CONSTRAINT "processors_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "purposes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
