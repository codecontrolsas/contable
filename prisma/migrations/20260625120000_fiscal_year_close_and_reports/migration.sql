-- Sprint 4: Cierre de ejercicio completo + mejoras en reportes
-- Bloques 7 + 8 del plan de implementación contable

-- ============================================
-- 1. Campos closingEntryId y openingEntryId en FiscalYear
-- ============================================

ALTER TABLE "fiscal_years" ADD COLUMN "closing_entry_id" UUID;
ALTER TABLE "fiscal_years" ADD COLUMN "opening_entry_id" UUID;

CREATE UNIQUE INDEX "fiscal_years_closing_entry_id_key" ON "fiscal_years"("closing_entry_id");
CREATE UNIQUE INDEX "fiscal_years_opening_entry_id_key" ON "fiscal_years"("opening_entry_id");

ALTER TABLE "fiscal_years"
    ADD CONSTRAINT "fiscal_years_closing_entry_id_fkey"
    FOREIGN KEY ("closing_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fiscal_years"
    ADD CONSTRAINT "fiscal_years_opening_entry_id_fkey"
    FOREIGN KEY ("opening_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 2. Backfill: vincular asientos de cierre existentes
-- ============================================

UPDATE "fiscal_years" fy SET
  "closing_entry_id" = (
    SELECT je.id FROM "journal_entries" je
    WHERE je.company_id = fy.company_id
      AND je.description LIKE 'Cierre de ejercicio fiscal%'
      AND je.date >= fy.start_date
      AND je.date <= fy.end_date
      AND je.status = 'POSTED'
    ORDER BY je.date DESC
    LIMIT 1
  )
WHERE fy.is_closed = true AND fy."closing_entry_id" IS NULL;
