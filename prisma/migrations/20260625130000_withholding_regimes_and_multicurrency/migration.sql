-- Sprint 5: Retenciones (regímenes + padrones) y Multi-moneda
-- Bloques 9 + 10 del plan de implementación contable

-- ============================================
-- 1. Campos fiscales en Supplier
-- ============================================

ALTER TABLE "suppliers" ADD COLUMN "income_tax_condition" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "iibb_condition" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "iibb_jurisdiction" TEXT;

-- ============================================
-- 2. Regímenes de retención
-- ============================================

CREATE TABLE "withholding_regimes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "tax" "withholding_tax_type" NOT NULL,
    "jurisdiction" TEXT,
    "regime_code" TEXT,
    "name" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "base_calculation" TEXT NOT NULL DEFAULT 'NET',
    "default_rate" DECIMAL(6, 3) NOT NULL,
    "minimum_not_subject" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "minimum_retention" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withholding_regimes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "withholding_regimes"
    ADD CONSTRAINT "withholding_regimes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "withholding_regimes"
    ADD CONSTRAINT "withholding_regimes_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 3. Padrones de alícuotas
-- ============================================

CREATE TABLE "tax_rate_padrons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "tax_id" TEXT NOT NULL,
    "tax" "withholding_tax_type" NOT NULL,
    "jurisdiction" TEXT,
    "perception_rate" DECIMAL(6, 3),
    "retention_rate" DECIMAL(6, 3),
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rate_padrons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_rate_padrons_company_id_tax_id_tax_jurisdiction_valid_f_key"
    ON "tax_rate_padrons"("company_id", "tax_id", "tax", "jurisdiction", "valid_from");

CREATE INDEX "tax_rate_padrons_company_id_tax_id_tax_idx"
    ON "tax_rate_padrons"("company_id", "tax_id", "tax");

ALTER TABLE "tax_rate_padrons"
    ADD CONSTRAINT "tax_rate_padrons_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 4. Multi-moneda: campos en JournalEntryLine
-- ============================================

ALTER TABLE "journal_entry_lines" ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'ARS';
ALTER TABLE "journal_entry_lines" ADD COLUMN "original_amount" DECIMAL(18, 2);
ALTER TABLE "journal_entry_lines" ADD COLUMN "exchange_rate" DECIMAL(18, 6);

-- ============================================
-- 5. Multi-moneda: currency en Account
-- ============================================

ALTER TABLE "accounts" ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'ARS';

-- ============================================
-- 6. Tabla de tipos de cambio
-- ============================================

CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "date" DATE NOT NULL,
    "buy_rate" DECIMAL(18, 6) NOT NULL,
    "sell_rate" DECIMAL(18, 6) NOT NULL,
    "source" TEXT,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exchange_rates_company_id_currency_date_key"
    ON "exchange_rates"("company_id", "currency", "date");

ALTER TABLE "exchange_rates"
    ADD CONSTRAINT "exchange_rates_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
