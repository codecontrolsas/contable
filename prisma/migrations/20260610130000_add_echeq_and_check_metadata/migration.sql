-- AlterEnum
ALTER TYPE "payment_method" ADD VALUE 'ECHEQ';

-- AlterTable
ALTER TABLE "checks" ADD COLUMN "is_electronic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "receipt_payments"
  ADD COLUMN "check_bank_name" TEXT,
  ADD COLUMN "check_issue_date" TIMESTAMP(3),
  ADD COLUMN "check_due_date" TIMESTAMP(3),
  ADD COLUMN "check_drawer_name" TEXT,
  ADD COLUMN "check_drawer_tax_id" TEXT;

-- AlterTable
ALTER TABLE "payment_order_payments"
  ADD COLUMN "check_bank_name" TEXT,
  ADD COLUMN "check_issue_date" TIMESTAMP(3),
  ADD COLUMN "check_due_date" TIMESTAMP(3),
  ADD COLUMN "check_drawer_name" TEXT,
  ADD COLUMN "check_drawer_tax_id" TEXT;
