-- Bloque 14: Ajuste por inflación (RECPAM)

-- Campo adjustableByInflation en cuentas
ALTER TABLE "accounts"
ADD COLUMN "adjustable_by_inflation" BOOLEAN NOT NULL DEFAULT false;

-- Cuenta RECPAM en settings
ALTER TABLE "accounting_settings"
ADD COLUMN "recpam_account_id" UUID;

ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_recpam_account_id_fkey"
FOREIGN KEY ("recpam_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tabla de índices de inflación (IPC)
CREATE TABLE "inflation_indices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "index" DECIMAL(18, 6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inflation_indices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inflation_indices_company_id_year_month_key"
ON "inflation_indices"("company_id", "year", "month");

ALTER TABLE "inflation_indices"
ADD CONSTRAINT "inflation_indices_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
