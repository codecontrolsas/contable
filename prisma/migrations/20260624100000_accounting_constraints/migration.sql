-- Bloque 0: Constraints de DB y seguridad de datos contables
-- Este migration agrega CHECK constraints y triggers de inmutabilidad
-- para proteger la integridad de los asientos contables a nivel de base de datos.

-- ============================================
-- PASO 1: Limpiar datos inconsistentes (si existen)
-- ============================================

-- Filas con debit = 0 AND credit = 0 no deberían existir (líneas vacías)
DELETE FROM "public"."journal_entry_lines"
WHERE "debit" = 0 AND "credit" = 0;

-- Filas con ambos > 0 no deberían existir (una línea es Debe O Haber, no ambos)
-- Si existen, separar en dos líneas: una de débito y una de crédito
-- NOTA: En la práctica esto no debería ocurrir porque la app lo valida,
-- pero si ocurriera, es mejor separar que perder datos.
-- Por seguridad, solo verificamos y fallamos si hay datos inconsistentes.
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM "public"."journal_entry_lines"
  WHERE "debit" > 0 AND "credit" > 0;

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Existen % líneas de asiento con debit > 0 AND credit > 0. Corregir manualmente antes de aplicar esta migración.', bad_count;
  END IF;
END $$;

-- ============================================
-- PASO 2: CHECK constraints en journal_entry_lines
-- ============================================

ALTER TABLE "public"."journal_entry_lines"
  ADD CONSTRAINT "chk_jel_debit_non_negative" CHECK ("debit" >= 0);

ALTER TABLE "public"."journal_entry_lines"
  ADD CONSTRAINT "chk_jel_credit_non_negative" CHECK ("credit" >= 0);

ALTER TABLE "public"."journal_entry_lines"
  ADD CONSTRAINT "chk_jel_debit_or_credit" CHECK (
    ("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)
  );

-- ============================================
-- PASO 3: Trigger de inmutabilidad en journal_entries
-- ============================================

CREATE OR REPLACE FUNCTION "public"."prevent_posted_entry_modification"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Asiento POSTED: solo permitir transición a REVERSED (con campos de reversión)
  IF OLD.status = 'POSTED' THEN
    IF TG_OP = 'UPDATE' AND NEW.status = 'REVERSED' THEN
      RETURN NEW;
    END IF;
    -- Permitir UPDATE que solo agrega journalEntryId desde documentos comerciales
    -- (esto NO aplica aquí porque los documentos tienen FK hacia journal_entries, no al revés)
    RAISE EXCEPTION 'No se puede modificar ni eliminar un asiento contable registrado (POSTED). Use una reversión. [id=%]', OLD.id;
  END IF;

  -- Asiento REVERSED: no se puede modificar ni eliminar
  IF OLD.status = 'REVERSED' THEN
    RAISE EXCEPTION 'No se puede modificar ni eliminar un asiento contable anulado (REVERSED). [id=%]', OLD.id;
  END IF;

  -- DRAFT: permitir cualquier operación
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER "trg_journal_entry_immutable"
BEFORE UPDATE OR DELETE ON "public"."journal_entries"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_entry_modification"();

-- ============================================
-- PASO 4: Trigger de inmutabilidad en journal_entry_lines
-- ============================================

CREATE OR REPLACE FUNCTION "public"."prevent_posted_entry_line_modification"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_status TEXT;
  v_entry_id UUID;
BEGIN
  -- Determinar el entry_id según la operación
  v_entry_id := COALESCE(OLD.entry_id, NEW.entry_id);

  SELECT status INTO v_status
  FROM "public"."journal_entries"
  WHERE id = v_entry_id;

  IF v_status IN ('POSTED', 'REVERSED') THEN
    RAISE EXCEPTION 'No se pueden modificar líneas de un asiento contable con estado %. [entry_id=%]', v_status, v_entry_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER "trg_journal_entry_line_immutable"
BEFORE UPDATE OR DELETE ON "public"."journal_entry_lines"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_entry_line_modification"();
