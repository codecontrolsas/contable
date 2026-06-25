# Contable Sprint 1 — Correcciones Criticas de Seguridad y Bugs

**Fecha de inicio:** 2026-06-24
**Estado:** Analisis completado

---

## 1. Analisis

### 1.1 Problema

Este sprint aborda 3 bloques del plan de implementacion contable (`docs/contable/plan-implementacion-contable.md`) que son correcciones de seguridad e integridad de datos. No agregan funcionalidad nueva, solo estabilizan el modulo existente.

**Bloque 0 — Constraints de DB y seguridad de datos**

Todas las validaciones contables (partida doble, inmutabilidad de asientos registrados, montos no negativos, exclusion debit/credit) solo existen en la capa de aplicacion (archivo `validators/index.ts`). Una query directa a la base de datos, un script de migracion, o un bug en otro modulo podrian violar la integridad contable sin que nada lo impida. Se necesitan:

- CHECK constraints en `journal_entry_lines` para `debit >= 0`, `credit >= 0`, y que no puedan ser ambos > 0 simultaneamente.
- Trigger de inmutabilidad en `journal_entries` para impedir UPDATE/DELETE de asientos POSTED o REVERSED (excepto la transicion POSTED -> REVERSED).
- Trigger de inmutabilidad en `journal_entry_lines` para impedir UPDATE/DELETE de lineas cuyos asientos estan POSTED o REVERSED.

**Bloque 3 — Numeracion atomica de asientos**

El patron actual de numeracion tiene un race condition: `lastEntryNumber` se lee fuera de la transaccion (via `prisma.accountingSettings.findUnique`) y el numero incrementado se usa dentro del `$transaction`. Si dos transacciones leen el mismo `lastEntryNumber` al mismo tiempo, ambas intentan crear el asiento con el mismo numero. El unique index `journal_entries_company_id_number_key` lo detecta y produce un error, pero el usuario pierde su operacion. Se necesita usar `UPDATE ... RETURNING` dentro de la transaccion para atomizar el incremento.

**Bloque 6 — Puente contable: correcciones criticas**

Dos bugs criticos:

1. **Periodo bloqueado retorna null silenciosamente**: Cuando la fecha del documento cae en un periodo bloqueado, `createJournalEntry()` (el helper privado en `integrations/commercial/index.ts`) retorna `null` sin lanzar error. Los callers (confirmInvoice, etc.) capturan este `null` y simplemente no vinculan el asiento, pero la factura se confirma sin contabilizar. Nadie es notificado. Se necesita lanzar un error que impida la confirmacion del documento.

2. **`getMonthlyVATReport` no invierte signo para notas de credito**: El reporte IVA mensual (en `reports/actions.server.ts`, lineas 1358-1495) consulta todas las facturas de venta y compra del mes pero NO selecciona el campo `voucherType`, por lo tanto no puede distinguir facturas de notas de credito. Las NC se suman como positivas en todos los acumuladores (subtotal, vatAmount, total, y por alicuota), sobreestimando el IVA debito/credito fiscal.

### 1.2 Contexto actual

#### Bloque 0 — Estado actual de la DB

**Tabla `journal_entries`** (linea 1097 de `0_init/migration.sql`):
```sql
CREATE TABLE "public"."journal_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."journal_entry_status" NOT NULL DEFAULT 'DRAFT',
    "post_date" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    ...
);
```
- No tiene CHECK constraints.
- No tiene triggers de inmutabilidad.
- El enum `journal_entry_status` tiene: `DRAFT`, `POSTED`, `REVERSED`.
- Unique index: `journal_entries_company_id_number_key(company_id, number)`.

**Tabla `journal_entry_lines`** (linea 1117 de `0_init/migration.sql`):
```sql
CREATE TABLE "public"."journal_entry_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
);
```
- Sin CHECK constraints. Nada impide `debit = -5` o `debit = 100 AND credit = 50` a nivel de DB.

**Validaciones en la capa de aplicacion** (`src/modules/accounting/features/entries/validators/index.ts`):
- `validateJournalEntryAmounts()` (linea 142): valida `debit >= 0`, `credit >= 0`, no ambos > 0, no ambos = 0.
- `validateJournalEntryBalance()` (linea 12): valida sum(debit) == sum(credit) con tolerancia 0.01.
- `validatePeriodLock()` (linea 73): valida que la fecha no este en periodo bloqueado.
- `validateJournalEntryDate()` (linea 101): valida que este dentro del ejercicio fiscal.
- `validateAccountNatures()` (linea 162): solo emite warnings, no bloquea.

Estas validaciones solo se invocan desde `createJournalEntry()` y `postJournalEntry()` en `entries/actions.server.ts`. Las integraciones automaticas (commercial, equipment) NO invocan estos validadores — tienen su propia validacion inline (solo balance, linea 120-130 de `integrations/commercial/index.ts` y linea 81-88 de `integrations/equipment/index.ts`).

#### Bloque 3 — Patron actual de numeracion

Hay **7 puntos** en el codigo que crean asientos y manejan numeracion. Todos siguen el patron vulnerable:

1. **`entries/actions.server.ts` — `createJournalEntry()`** (linea 16):
   - Lee settings FUERA de la transaccion (linea 23: `prisma.accountingSettings.findUnique`).
   - Usa `settings.lastEntryNumber + 1` dentro del `$transaction` (linea 46).
   - Actualiza `lastEntryNumber` dentro de la transaccion (linea 84).

2. **`entries/actions.server.ts` — `reverseJournalEntry()`** (linea 205):
   - Lee settings FUERA de la transaccion (linea 252: `prisma.accountingSettings.findUnique`).
   - Usa `settings.lastEntryNumber + 1` dentro del `$transaction` (linea 266).
   - Actualiza dentro de la transaccion (linea 323).

3. **`integrations/commercial/index.ts` — `createJournalEntry()` (helper privado)** (linea 136):
   - Lee settings DENTRO de la transaccion (linea 146: `tx.accountingSettings.findUnique`).
   - Pero usa `settings.lastEntryNumber + 1` sin lock atomico (linea 168).
   - Actualiza dentro de la transaccion (linea 190).
   - **Nota**: Este helper ya recibe `tx` como parametro, por lo que la lectura esta dentro de la transaccion, pero no es un `SELECT FOR UPDATE` — otra transaccion concurrente podria leer el mismo valor antes del update.

4. **`integrations/equipment/index.ts` — `createJournalEntry()` (helper privado)** (linea 69):
   - Mismo patron que el comercial. Lee con `tx.accountingSettings.findUnique` (linea 90), incrementa (linea 107), actualiza (linea 127).
   - Misma vulnerabilidad que el punto 3.

5. **`fiscal-year-close/actions.server.ts` — `closeFiscalYear()`** (linea 232):
   - Lee settings FUERA de la transaccion (linea 238: `prisma.accountingSettings.findUnique`).
   - Usa `settings.lastEntryNumber + 1` dentro del `$transaction` (linea 278).
   - Actualiza dentro de la transaccion (linea 304).

6. **`equipment/features/depreciation/actions.server.ts` — `postSingleDepreciation()`** (alrededor de linea 454):
   - Lee settings FUERA de la transaccion (linea 455: `prisma.accountingSettings.findUnique`).
   - Usa `settings.lastEntryNumber + 1` dentro del `$transaction` (linea 487).
   - Actualiza dentro de la transaccion (linea 517).

7. **`equipment/features/depreciation/actions.server.ts` — `postAllPendingDepreciations()`** (alrededor de linea 570):
   - Lee settings FUERA de la transaccion (linea 582).
   - Usa `currentEntryNumber++` en un loop DENTRO de la transaccion (linea 632-660).
   - Actualiza al final del loop (linea 734).
   - Caso especial: crea multiples asientos en un loop.

8. **`equipment/features/depreciation/actions.server.ts` — `adjustAssetValue()`** (alrededor de linea 790):
   - Lee settings FUERA de la transaccion (linea 799).
   - Usa `(settings.lastEntryNumber ?? 0) + 1` dentro del `$transaction` (linea 822).
   - Actualiza dentro de la transaccion (linea 870).

#### Bloque 6.1 — Periodo bloqueado silencioso

**Funcion afectada**: `createJournalEntry()` helper privado en `src/modules/accounting/features/integrations/commercial/index.ts`, lineas 155-165:

```typescript
if (settings.lockedUntilDate && moment(date).isSameOrBefore(moment(settings.lockedUntilDate), 'day')) {
    logger.warn('Asiento automatico omitido por periodo bloqueado', { ... });
    return null;  // <-- SILENCIO PELIGROSO
}
```

**Callers que ignoran el null** (todos dentro de `try/catch` que no re-lanzan):

| Archivo | Linea | Comportamiento |
|---|---|---|
| `commercial/features/sales/features/invoices/list/actions.server.ts` | 908 | `if (journalEntryId) { ... }` — si es null, la factura se confirma sin asiento. El catch en linea 921 tampoco re-lanza: "No lanzar error para no interrumpir la confirmacion". |
| `commercial/features/purchases/features/invoices/list/actions.server.ts` | 1194 | Mismo patron. |
| `commercial/features/treasury/features/receipts/actions.server.ts` | 392 | Mismo patron. |
| `commercial/features/treasury/features/payment-orders/actions.server.ts` | 727 | Mismo patron. |
| `commercial/features/expenses/actions.server.ts` | 534 | Mismo patron. |

**Mismo bug en el helper de equipment** (`integrations/equipment/index.ts`, lineas 99-105):
```typescript
if (settings.lockedUntilDate && moment(date).isSameOrBefore(moment(settings.lockedUntilDate), 'day')) {
    logger.warn('Asiento de equipos omitido por periodo bloqueado', { ... });
    return null;
}
```

**Decision requerida**: La opcion A (lanzar error, bloquear la operacion) es la recomendada. Al implementar, el error se propagara por el `throw error` del catch externo de cada funcion de integracion (ej: linea 296 de commercial/index.ts), y luego sera capturado por el `catch` del caller. Actualmente los callers tienen `catch` que solo loguean un warning y NO re-lanzan. Esto se debe cambiar para que el error de periodo bloqueado se propague al usuario.

#### Bloque 6.2 — NC en reporte IVA

**Funcion afectada**: `getMonthlyVATReport()` en `src/modules/accounting/features/reports/actions.server.ts`, lineas 1358-1495.

**El problema**: La query de `salesInvoices` (linea 1374) NO selecciona `voucherType`. Por lo tanto, el codigo en lineas 1416-1421 (summaries) y 1434-1442 (vatByRate) suma todos los montos sin distinguir facturas de notas de credito. Si en un mes hay una factura de $1000+IVA y una NC de $200+IVA, el reporte muestra subtotal $1200, IVA $252, total $1452 — cuando deberia mostrar subtotal $800, IVA $168, total $968.

**Misma situacion para compras** (linea 1395): tampoco selecciona `voucherType` de `purchaseInvoice`.

**Utilidad disponible**: `isCreditNote()` de `@/modules/commercial/shared/voucher-utils` (ya importada en commercial/index.ts pero NO en reports/actions.server.ts). Acepta un `voucherType: string` y retorna `true` para `NOTA_CREDITO_A`, `NOTA_CREDITO_B`, `NOTA_CREDITO_C`.

### 1.3 Archivos involucrados

#### Bloque 0 — Constraints de DB

| Archivo | Cambio |
|---|---|
| `prisma/migrations/YYYYMMDD_accounting_constraints/migration.sql` | **NUEVO**. Crear migracion con: (1) CHECK constraints en `journal_entry_lines`, (2) trigger de inmutabilidad en `journal_entries`, (3) trigger de inmutabilidad en `journal_entry_lines`. |

No se requieren cambios en el schema de Prisma ni en codigo de aplicacion. Los CHECKs y triggers son transparentes para la aplicacion existente (ya cumple las reglas).

#### Bloque 3 — Numeracion atomica

| Archivo | Funcion | Cambio |
|---|---|---|
| `src/modules/accounting/features/entries/actions.server.ts` | `createJournalEntry()` (linea 16) | Mover la lectura de settings DENTRO de la transaccion. Reemplazar lectura + incremento por `UPDATE ... RETURNING` atomico via `tx.$queryRaw`. |
| `src/modules/accounting/features/entries/actions.server.ts` | `reverseJournalEntry()` (linea 205) | Idem. Mover lectura de settings dentro de la transaccion y usar `UPDATE ... RETURNING`. |
| `src/modules/accounting/features/integrations/commercial/index.ts` | `createJournalEntry()` helper (linea 136) | Reemplazar `tx.accountingSettings.findUnique` + incremento manual por `tx.$queryRaw` con `UPDATE ... RETURNING`. |
| `src/modules/accounting/features/integrations/equipment/index.ts` | `createJournalEntry()` helper (linea 69) | Idem al comercial. |
| `src/modules/accounting/features/fiscal-year-close/actions.server.ts` | `closeFiscalYear()` (linea 232) | Mover lectura de settings dentro de la transaccion y usar `UPDATE ... RETURNING`. |
| `src/modules/equipment/features/depreciation/actions.server.ts` | `postSingleDepreciation()` (~linea 454) | Mover lectura de settings dentro de la transaccion y usar `UPDATE ... RETURNING`. |
| `src/modules/equipment/features/depreciation/actions.server.ts` | `postAllPendingDepreciations()` (~linea 570) | Caso especial: el loop crea N asientos. Cada iteracion debe hacer su propio `UPDATE ... RETURNING` para obtener el siguiente numero. Alternativa: hacer un solo `UPDATE SET last_entry_number = last_entry_number + N RETURNING` al inicio y calcular los numeros desde el rango. La primera opcion es mas segura aunque menos performante. |
| `src/modules/equipment/features/depreciation/actions.server.ts` | `adjustAssetValue()` (~linea 790) | Mover lectura de settings dentro de la transaccion y usar `UPDATE ... RETURNING`. |

**Patron atomico a usar** (dentro de `tx.$transaction` o con `tx` ya disponible):
```typescript
const [{ last_entry_number: nextNumber }] = await tx.$queryRaw<[{ last_entry_number: number }]>`
  UPDATE accounting_settings
  SET last_entry_number = last_entry_number + 1, updated_at = NOW()
  WHERE company_id = ${companyId}::uuid
  RETURNING last_entry_number
`;
```
Esto hace un `SELECT FOR UPDATE` implicito, incrementa, y retorna el nuevo valor, todo atomicamente.

#### Bloque 6 — Puente contable

| Archivo | Funcion | Cambio |
|---|---|---|
| `src/modules/accounting/features/integrations/commercial/index.ts` | `createJournalEntry()` helper (linea 136) | Reemplazar `return null` por `throw new Error(...)` cuando el periodo esta bloqueado (lineas 155-165). |
| `src/modules/accounting/features/integrations/equipment/index.ts` | `createJournalEntry()` helper (linea 69) | Idem — reemplazar `return null` por `throw new Error(...)` cuando el periodo esta bloqueado (lineas 99-105). |
| `src/modules/commercial/features/sales/features/invoices/list/actions.server.ts` | `confirmInvoice()` | Cambiar el `catch` de la llamada a `createJournalEntryForSalesInvoice` (lineas 921-926): re-lanzar el error si es de periodo bloqueado, en vez de tragarlo. |
| `src/modules/commercial/features/purchases/features/invoices/list/actions.server.ts` | `confirmPurchaseInvoice()` | Idem. |
| `src/modules/commercial/features/treasury/features/receipts/actions.server.ts` | `confirmReceipt()` | Idem. |
| `src/modules/commercial/features/treasury/features/payment-orders/actions.server.ts` | `confirmPaymentOrder()` | Idem. |
| `src/modules/commercial/features/expenses/actions.server.ts` | `confirmExpense()` | Idem. |
| `src/modules/accounting/features/reports/actions.server.ts` | `getMonthlyVATReport()` (linea 1358) | (1) Agregar `voucherType: true` al `select` de salesInvoices y purchaseInvoices. (2) Aplicar `sign = isCreditNote(inv.voucherType) ? -1 : 1` a todos los acumuladores. (3) Agregar import de `isCreditNote`. |

### 1.4 Dependencias

| Dependencia | Uso |
|---|---|
| PostgreSQL | Triggers y CHECK constraints son features nativas de PG. |
| Prisma 7 | `tx.$queryRaw` para la query atomica de numeracion. Prisma soporta `$queryRaw` dentro de transacciones interactivas. |
| moment.js | Ya importado en los archivos relevantes. Se usa para formatear fechas en mensajes de error. |
| `isCreditNote` de `@/modules/commercial/shared/voucher-utils` | Ya existe. Solo necesita importarse en `reports/actions.server.ts`. |
| `VoucherType` enum | `NOTA_CREDITO_A`, `NOTA_CREDITO_B`, `NOTA_CREDITO_C` — ya definido en Prisma schema. |

### 1.5 Restricciones y reglas

**Reglas de CLAUDE.md que aplican:**

1. **Logger, NO console.*** — Todos los archivos ya usan `logger`. Mantener.
2. **moment.js para fechas** — Los archivos ya usan moment. Mantener.
3. **Server Actions con checkPermission** — Las funciones de entries/actions.server.ts ya lo tienen. Las integraciones son helpers internos llamados por server actions que ya validaron permisos. No se necesita agregar.
4. **Prisma Decimal -> Number()** — No aplica directamente a este sprint (no hay nuevos datos pasados a client components).
5. **Tests E2E** — El plan exige tests en `cypress/e2e/accounting/`. Se deben crear/actualizar tests que verifiquen los criterios de aceptacion.
6. **Documentacion de desarrollador** — Actualizar `docs/contable/` con los cambios.
7. **Migraciones**: Una migracion por bloque, nombrada `YYYYMMDD_bloque_N_descripcion`.

**Restricciones tecnicas:**

- **Bloque 0 — Datos existentes**: Antes de aplicar CHECKs, verificar que no existan filas con `debit = 0 AND credit = 0` o `debit > 0 AND credit > 0`. Si existen, la migracion debe corregirlas primero.
- **Bloque 0 — Trigger vs. aplicacion**: El trigger de inmutabilidad bloqueara CUALQUIER UPDATE a un asiento POSTED, incluyendo el que actualmente hace el `reverseJournalEntry()` para marcar el original como REVERSED. El trigger debe permitir explicita y unicamente la transicion `status = 'POSTED' -> status = 'REVERSED'` (ya previsto en el plan).
- **Bloque 0 — Trigger de lineas y reversiones**: Cuando se revierte un asiento, el trigger de `journal_entry_lines` verificara el status del entry padre. Como la reversion crea un NUEVO entry (con sus propias lineas), no modifica lineas del entry original. El unico UPDATE al entry original es cambiar su status a REVERSED + setear `reversalEntryId`, `reversedBy`, `reversedAt`. El trigger debe permitir esto.
- **Bloque 3 — `$queryRaw` dentro de transacciones**: Prisma 7 soporta `$queryRaw` dentro de `tx` en transacciones interactivas. Verificar que no haya limitaciones con el adapter-pg.
- **Bloque 3 — Caso especial de depreciaciones masivas**: `postAllPendingDepreciations()` crea multiples asientos en un loop dentro de una sola transaccion. Cada iteracion necesita obtener un numero atomico. Opciones: (a) N llamadas a `UPDATE ... RETURNING` (mas seguro, N queries extra), (b) una sola llamada `SET last_entry_number = last_entry_number + N RETURNING last_entry_number - N` para reservar un rango (mas eficiente, calcular numeros secuencialmente). Recomendar opcion (b) por performance.
- **Bloque 6 — Compatibilidad**: Al cambiar el helper para lanzar error en periodo bloqueado, la funcion ya retorna `Promise<string | null>`. Ahora lanzara excepcion en vez de retornar null para ese caso. Los callers que esperan null deben ajustar su manejo de errores.

### 1.6 Riesgos identificados

1. **Datos inconsistentes existentes (Bloque 0)**: Si hay filas en `journal_entry_lines` con `debit = 0 AND credit = 0` (lineas nulas) o `debit > 0 AND credit > 0` (lineas dobles), la migracion fallara al aplicar el CHECK. Se debe incluir una query de limpieza PREVIA al CHECK en la migracion. Esto requiere inspeccionar los datos de produccion antes del deploy.

2. **Trigger de inmutabilidad demasiado restrictivo (Bloque 0)**: El trigger en `journal_entries` permite UPDATE solo si `OLD.status = 'POSTED' AND NEW.status = 'REVERSED'`. Pero `reverseJournalEntry()` hace un UPDATE que cambia multiples campos (`status`, `reversalEntryId`, `reversedBy`, `reversedAt`). El trigger debe verificar solo la transicion de status y permitir que los otros campos cambien en el mismo UPDATE. El SQL propuesto en el plan ya maneja esto correctamente (solo valida la condicion y retorna NEW).

3. **Performance del trigger en journal_entry_lines (Bloque 0)**: El trigger de lineas hace un `SELECT status FROM journal_entries WHERE id = entry_id` por cada UPDATE/DELETE de linea. En operaciones masivas (ej: depreciaciones masivas que crean 50 asientos con 2 lineas cada uno = 100 INSERTs), este SELECT extra es despreciable porque es por PK. Sin embargo, para DELETE masivos (que no deberian ocurrir en operacion normal), podria ser mas costoso. Riesgo bajo.

4. **Race condition residual con Prisma adapter-pg (Bloque 3)**: Verificar que `tx.$queryRaw` con el adapter-pg de Prisma 7 realmente ejecute la query dentro de la transaccion PostgreSQL y no en una conexion separada. Si el adapter usa un pool, la query podria ir a otra conexion. Esto debe testearse. Si falla, la alternativa es usar `tx.$executeRaw` para el UPDATE y `tx.accountingSettings.findUnique` para leer el valor actualizado despues.

5. **Efecto en UX del error de periodo bloqueado (Bloque 6)**: Actualmente el usuario puede confirmar facturas sin saber que no se genero asiento contable. Al cambiar a lanzar error, el usuario vera un mensaje de error y la operacion sera rechazada. Esto es el comportamiento correcto, pero podria sorprender a usuarios que antes podian confirmar facturas en periodos bloqueados. Se debe documentar este cambio y comunicar al equipo.

6. **Errores de contabilidad no criticos vs. criticos (Bloque 6)**: El catch actual en los callers atrapa TODOS los errores de la integracion contable y los traga. Al cambiar para re-lanzar errores de periodo bloqueado, se debe ser selectivo: solo re-lanzar errores de periodo bloqueado, no todos los errores contables (por ejemplo, cuentas no configuradas deberian seguir siendo warnings, no bloquear la operacion).

7. **Reporte IVA: notas de debito (Bloque 6)**: El fix actual solo contempla notas de credito. Las notas de debito (`NOTA_DEBITO_A/B/C`) deberian tratarse como positivas (igual que facturas). Verificar que el comportamiento actual sea correcto para ND tambien — actualmente no hay distincion, se suman como positivas, lo cual es correcto.

---

## 2. Planificacion
_Pendiente - ejecutar `/planificar contable-sprint1`_

## 3. Diseno
_Pendiente - ejecutar `/disenar contable-sprint1`_

## 4. Implementacion
_Pendiente - ejecutar `/implementar contable-sprint1`_

## 5. Verificacion
_Pendiente - ejecutar `/verificar contable-sprint1`_
