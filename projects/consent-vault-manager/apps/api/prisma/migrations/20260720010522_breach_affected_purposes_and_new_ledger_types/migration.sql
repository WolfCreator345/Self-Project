-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'breach_notice_drafted';
ALTER TYPE "LedgerEntryType" ADD VALUE 'breach_notice_deadline_scheduled';
ALTER TYPE "LedgerEntryType" ADD VALUE 'dsr_escalation_sent';
ALTER TYPE "LedgerEntryType" ADD VALUE 'weekly_report_sent';

-- AlterTable
ALTER TABLE "breach_events" ADD COLUMN     "affectedPurposeIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
