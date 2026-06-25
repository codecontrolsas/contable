-- Bloque 11: Cuentas adicionales para puente contable
-- CMV, Inventario, Cheques, Liquidación IVA

-- Cuentas de CMV e Inventario
ALTER TABLE "accounting_settings"
ADD COLUMN "cogs_account_id" UUID,
ADD COLUMN "inventory_account_id" UUID;

-- Cuentas de Cheques
ALTER TABLE "accounting_settings"
ADD COLUMN "checks_received_account_id" UUID,
ADD COLUMN "checks_rejected_account_id" UUID;

-- Cuentas de Liquidación IVA
ALTER TABLE "accounting_settings"
ADD COLUMN "vat_payable_account_id" UUID,
ADD COLUMN "vat_balance_account_id" UUID;

-- Foreign keys
ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_cogs_account_id_fkey"
FOREIGN KEY ("cogs_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_inventory_account_id_fkey"
FOREIGN KEY ("inventory_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_checks_received_account_id_fkey"
FOREIGN KEY ("checks_received_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_checks_rejected_account_id_fkey"
FOREIGN KEY ("checks_rejected_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_vat_payable_account_id_fkey"
FOREIGN KEY ("vat_payable_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_vat_balance_account_id_fkey"
FOREIGN KEY ("vat_balance_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
