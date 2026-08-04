/*
  Warnings:

  - Made the column `hash` on table `consent_ledger_entries` required. This step will fail if there are existing NULL values in that column.
  - Made the column `previousHash` on table `consent_ledger_entries` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "consent_ledger_entries" ALTER COLUMN "hash" SET NOT NULL,
ALTER COLUMN "previousHash" SET NOT NULL;
