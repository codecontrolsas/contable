-- CreateEnum
CREATE TYPE "card_type" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "card_owner_type" AS ENUM ('COMPANY', 'PARTNER');

-- CreateEnum
CREATE TYPE "payment_installment_status" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "partner_movement_type" AS ENUM ('OWED', 'REPAYMENT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "payment_order_payments" ADD COLUMN     "card_id" UUID,
ADD COLUMN     "installments_count" INTEGER;

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "card_type" "card_type" NOT NULL,
    "brand" TEXT,
    "last_four" TEXT,
    "owner_type" "card_owner_type" NOT NULL,
    "partner_id" UUID,
    "credit_limit" DECIMAL(15,2),
    "closing_day" INTEGER,
    "due_day" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_order_installments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "payment_order_id" UUID NOT NULL,
    "card_id" UUID,
    "number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "payment_installment_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_order_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_account_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "partner_movement_type" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT NOT NULL,
    "payment_order_id" UUID,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_account_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partners_company_id_idx" ON "partners"("company_id");

-- CreateIndex
CREATE INDEX "cards_company_id_idx" ON "cards"("company_id");

-- CreateIndex
CREATE INDEX "cards_partner_id_idx" ON "cards"("partner_id");

-- CreateIndex
CREATE INDEX "payment_order_installments_company_id_idx" ON "payment_order_installments"("company_id");

-- CreateIndex
CREATE INDEX "payment_order_installments_payment_order_id_idx" ON "payment_order_installments"("payment_order_id");

-- CreateIndex
CREATE INDEX "partner_account_movements_company_id_partner_id_idx" ON "partner_account_movements"("company_id", "partner_id");

-- AddForeignKey
ALTER TABLE "payment_order_payments" ADD CONSTRAINT "payment_order_payments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_order_installments" ADD CONSTRAINT "payment_order_installments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_order_installments" ADD CONSTRAINT "payment_order_installments_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_order_installments" ADD CONSTRAINT "payment_order_installments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_account_movements" ADD CONSTRAINT "partner_account_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_account_movements" ADD CONSTRAINT "partner_account_movements_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_account_movements" ADD CONSTRAINT "partner_account_movements_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
