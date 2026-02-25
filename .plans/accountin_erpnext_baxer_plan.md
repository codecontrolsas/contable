# Plan: Mejoras Contables inspiradas en ERPNext

## Contexto

Comparacion del modulo contable de ERPNext con Baxer para identificar funcionalidades clave a implementar. Se analizaron coincidencias, diferencias y el impacto de cada feature en el sistema existente (commercial, cashflow, proyecciones).

## Orden de Implementacion

| # | Feature | Prioridad | Impacto Cashflow | Estado |
|---|---------|-----------|-----------------|--------|
| 1 | Bloqueo de Periodos | Alta | Nulo | COMPLETADO |
| 2 | Saldos de Apertura | Media | Positivo (migra facturas) | Pendiente |
| 3 | Presupuestos | Alta | Bajo (comparativo) | Pendiente |
| 4 | Dimensiones Contables | Media | Bajo | Pendiente |
| 5 | Ingresos/Gastos Diferidos | Media | Nulo | Pendiente |
| 6 | Multi-Moneda | Alta | Alto | Pendiente |
| 7 | Reglas Fiscales | Baja | Nulo | Pendiente |

---

## 1. Bloqueo de Periodos Contables - COMPLETADO

### Diseno

Campo `lockedUntilDate` (DateTime?) en `AccountingSettings`. Bloqueo secuencial mensual: cualquier fecha <= lockedUntilDate esta en periodo bloqueado.

Ejemplo: `lockedUntilDate = 2024-06-30` → Enero a Junio 2024 bloqueados.

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | +campo `lockedUntilDate DateTime?` en AccountingSettings |
| `src/modules/accounting/features/entries/validators/index.ts` | +funcion `validatePeriodLock()`, integrada en `validateJournalEntryDate()` |
| `src/modules/accounting/features/entries/actions.server.ts` | +lock check en `postJournalEntry()` y `reverseJournalEntry()` |
| `src/modules/accounting/features/integrations/commercial/index.ts` | +lock check en helper `createJournalEntry()`, retorna null si bloqueado |
| `src/modules/accounting/features/integrations/equipment/index.ts` | +lock check en helper `createJournalEntry()`, retorna null si bloqueado |
| `src/modules/equipment/features/depreciation/actions.server.ts` | +lock check en `postDepreciationEntry()` y filtro en `postAllPendingDepreciations()` |
| `src/modules/accounting/features/settings/actions.server.ts` | +`getLockedPeriod()`, `setLockedPeriod()` |
| `src/modules/accounting/features/fiscal-year-close/actions.server.ts` | +auto-lock en `closeFiscalYear()` (setea lockedUntilDate = fiscalYearEnd) |
| `src/modules/accounting/features/settings/AccountingSettings.tsx` | +Card "Bloqueo de Periodos" con `_PeriodLockingForm` |
| `src/modules/accounting/features/settings/components/_PeriodLockingForm.tsx` | Nuevo componente: grid 12 meses, Lock/LockOpen icons, AlertDialog |
| `cypress/e2e/accounting/settings.cy.ts` | +tests: seccion visible, grid meses, dialog confirmacion, cancelar |
| `docs/modules/accounting.md` | +seccion "Bloqueo de Periodos" |
| `docs/architecture/data-model.md` | +campo lockedUntilDate en tabla AccountingSettings |

### Comportamiento por Operacion

| Operacion | En periodo bloqueado |
|-----------|---------------------|
| Crear asiento manual | Error: periodo bloqueado |
| Registrar (post) asiento borrador | Error: periodo bloqueado |
| Revertir asiento | Error: periodo bloqueado |
| Confirmar factura/recibo/OP/gasto | Documento se confirma, asiento automatico se omite con warning en logs |
| Contabilizar depreciacion individual | Error: periodo bloqueado |
| Contabilizar depreciaciones masivas | Filtra automaticamente periodos bloqueados |
| Cierre fiscal | Auto-bloquea todos los meses del ejercicio |

### UI

Grid responsive (3 cols mobile, 4 tablet, 6 desktop) con los meses del ejercicio fiscal. Solo dos celdas son interactivas: el primer mes desbloqueado (para bloquear) y el ultimo mes bloqueado (para desbloquear). Confirmacion via AlertDialog antes de cada accion.

---

## 2. Saldos de Apertura - Pendiente

**Objetivo**: Wizard para migrar saldos iniciales de empresas que vienen de otro sistema.

**Interaccion con existente**:
- Requiere plan de cuentas creado (import Excel ya existe)
- Implementado como un asiento contable con muchas lineas + cuenta temporal "Apertura" (EQUITY)
- Facturas pendientes migradas aparecen automaticamente en cashflow

**Modelo**: No requiere modelo nuevo. Usa JournalEntry existente + SalesInvoice/PurchaseInvoice en CONFIRMED sin asiento automatico.

---

## 3. Presupuestos y Control Presupuestario - Pendiente

**Objetivo**: Definir limites de gasto por cuenta contable y periodo, comparar planificado vs real.

**Interaccion con existente**:
- Reutiliza logica de `getTrialBalance()` para calcular ejecutado
- Sinergia con CashflowProjection: presupuesto contable (devengado) complementa proyecciones (caja)
- Al confirmar Expense, validar contra presupuesto (warning, no bloqueante)
- Nuevo reporte "Variacion Presupuestaria" extiende reportes existentes

**Modelo propuesto**:
```
Budget: companyId, accountId, fiscalYear, monthlyAmounts[], totalAmount
BudgetRevision: budgetId, date, previousAmount, newAmount, reason
```

---

## 4. Dimensiones Contables - Pendiente

**Objetivo**: Agregar `costCenterId` opcional a `JournalEntryLine` para analisis multidimensional.

**Interaccion con existente**:
- CostCenter ya existe (empleados, vehiculos)
- Los 6 flujos de `createJournalEntryFor*` necesitarian propagar dimensiones
- Reportes necesitarian filtro opcional por dimension
- Habilita distribucion de costos (feature 7 de la lista original)

**Enfoque**: Empezar con costCenterId fijo (no dimensiones genericas). Cubre 80% del caso de uso.

---

## 5. Ingresos y Gastos Diferidos - Pendiente

**Objetivo**: Distribuir ingresos de contratos o gastos prepagados en los periodos que corresponden.

**Interaccion con existente**:
- Flag en SalesInvoice/PurchaseInvoice (isDeferred, deferredStartDate, deferredEndDate)
- Genera asientos periodicos de reconocimiento (similar a RecurringEntry pero con fecha fin fija)
- Sin impacto en cashflow (el cash ya se registro al cobrar/pagar)
- Estado de Resultados refleja automaticamente solo lo reconocido

**Modelo propuesto**:
```
DeferredSchedule: documentType, documentId, totalAmount, deferredAccountId, revenueExpenseAccountId, startDate, endDate
DeferredEntry: scheduleId, periodNumber, date, amount, isPosted, journalEntryId
```

---

## 6. Contabilidad Multi-Moneda - Pendiente

**Objetivo**: Contabilizar operaciones en moneda extranjera con conversion y revaluacion.

**Interaccion con existente** (LA MAS INVASIVA):
- BankAccount ya tiene `currency` (default "ARS"), hoy se ignora
- Facturas necesitan `currency` + `exchangeRate`
- JournalEntryLine necesita `currency`, `exchangeRate`, `amountInCurrency`
- Cashflow necesita sumar bancos ARS + bancos USD convertidos
- Cierre fiscal necesita ejecutarse DESPUES de revaluacion de saldos
- Requiere tabla `ExchangeRate` (date, fromCurrency, toCurrency, rate)

**Complejidad**: Alta. Toca facturas, pagos, asientos, cashflow, reportes y cierre fiscal.

---

## 7. Reglas Fiscales Automaticas - Pendiente

**Objetivo**: Determinar automaticamente IVA y retenciones segun regimen del cliente/proveedor.

**Interaccion con existente**:
- Contractor y Supplier ya tienen `taxCondition`
- Al seleccionar cliente en factura, la regla determina voucherType y vatRate
- Sin impacto en cashflow
- Requiere tabla `TaxRule` con condiciones y acciones

---

## Analisis de Impacto en Cashflow y Proyecciones

| Feature | Impacto Cashflow | Impacto Proyecciones | Impacto Asientos Auto |
|---------|-----------------|---------------------|----------------------|
| Bloqueo Periodos | Nulo | Nulo | Medio (validacion) |
| Saldos Apertura | Positivo (migra facturas) | Nulo | Bajo (asiento unico) |
| Presupuestos | Bajo (comparativo) | Sinergia (auto-generar) | Nulo |
| Dimensiones | Bajo (segmentacion opcional) | Nulo | Alto (propagar a 6 flujos) |
| Diferidos | Nulo (cash ya registrado) | Nulo | Medio (asientos periodicos) |
| Multi-Moneda | Alto (conversion, saldos) | Alto (montos fluctuantes) | Alto (tipo de cambio) |
| Reglas Fiscales | Nulo | Nulo | Bajo (composicion IVA) |
