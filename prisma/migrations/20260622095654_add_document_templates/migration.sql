-- CreateEnum
CREATE TYPE "public"."document_template_type" AS ENUM ('PAYMENT_ORDER', 'RECEIPT', 'SALES_INVOICE', 'PURCHASE_INVOICE', 'PURCHASE_ORDER', 'DELIVERY_NOTE', 'RECEIVING_NOTE', 'QUOTE', 'STOCK_TRANSFER');

-- CreateEnum
CREATE TYPE "public"."document_template_theme" AS ENUM ('CLASSIC', 'MODERN', 'MINIMAL');

-- CreateTable
CREATE TABLE "public"."document_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "document_type" "public"."document_template_type" NOT NULL,
    "theme" "public"."document_template_theme" NOT NULL DEFAULT 'CLASSIC',
    "primary_color" TEXT,
    "header_text" TEXT,
    "footer_text" TEXT,
    "notes_default" TEXT,
    "show_cae" BOOLEAN NOT NULL DEFAULT true,
    "show_notes" BOOLEAN NOT NULL DEFAULT true,
    "show_withholdings" BOOLEAN NOT NULL DEFAULT true,
    "show_issuer" BOOLEAN NOT NULL DEFAULT true,
    "show_receiver" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_templates_company_id_idx" ON "public"."document_templates"("company_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_company_id_document_type_key" ON "public"."document_templates"("company_id" ASC, "document_type" ASC);

-- AddForeignKey
ALTER TABLE "public"."document_templates" ADD CONSTRAINT "document_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
