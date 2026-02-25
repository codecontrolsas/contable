# Plan: Mejoras Contables inspiradas en ERPNext

## Contexto

Comparacion del modulo contable de ERPNext con Baxer para identificar funcionalidades clave a implementar. Se analizaron coincidencias, diferencias y el impacto de cada feature en el sistema existente (commercial, cashflow, proyecciones).

## Orden de Implementacion

| # | Feature | Prioridad | Impacto Cashflow | Estado |
|---|---------|-----------|-----------------|--------|
| 1 | Bloqueo de Periodos | Alta | Nulo | COMPLETADO |
| 2 | Saldos de Apertura | Media | Positivo (migra facturas) | COMPLETADO |
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

## 2. Saldos de Apertura - COMPLETADO

### Diseno

Pagina dedicada con 3 tabs: Asiento de Apertura, Facturas de Venta Pendientes, Facturas de Compra Pendientes.

- **Asiento de Apertura**: JournalEntry POSTED con lineas por cuenta, balanceado automaticamente con cuenta "Apertura" (EQUITY, codigo 3.0.1, auto-creada)
- **Facturas Pendientes**: SalesInvoice/PurchaseInvoice simplificadas (sin lineas de producto), status CONFIRMED, journalEntryId=null, marcadas con internalNotes='opening-balance'
- **Import Excel**: plantillas descargables con ExcelJS, resolucion de cliente/proveedor por nombre o CUIT

### Archivos Creados

| Archivo | Funcion |
|---------|---------|
| `src/modules/accounting/features/opening-balances/actions.server.ts` | Server actions: getOpeningBalancesPageData, saveOpeningBalanceEntry, createOpeningSalesInvoice, createOpeningPurchaseInvoice, deleteOpeningInvoice, importFromExcel |
| `src/modules/accounting/features/opening-balances/validators.ts` | Schemas Zod para saldos y facturas |
| `src/modules/accounting/features/opening-balances/types.ts` | Tipos inferidos |
| `src/modules/accounting/features/opening-balances/OpeningBalancesPage.tsx` | Server Component con verificacion de prerequisitos |
| `src/modules/accounting/features/opening-balances/components/_OpeningBalancesTabs.tsx` | Layout con Tabs |
| `src/modules/accounting/features/opening-balances/components/_AccountBalancesForm.tsx` | Grilla de saldos por cuenta, agrupada por tipo, con busqueda y totales |
| `src/modules/accounting/features/opening-balances/components/_PendingSalesInvoicesTab.tsx` | Tab facturas de venta con tabla, crear y eliminar |
| `src/modules/accounting/features/opening-balances/components/_PendingPurchasesTab.tsx` | Tab facturas de compra |
| `src/modules/accounting/features/opening-balances/components/_CreateInvoiceDialog.tsx` | Dialog compartido para crear factura simplificada |
| `src/modules/accounting/features/opening-balances/components/_InvoiceImportDialog.tsx` | Dialog de import Excel con plantilla |
| `src/modules/accounting/features/opening-balances/lib/invoices-excel-template.ts` | Generador de plantillas Excel |
| `src/app/(core)/dashboard/company/accounting/opening-balances/page.tsx` | Ruta de la pagina |
| `cypress/e2e/accounting/opening-balances.cy.ts` | Tests E2E |

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/shared/lib/permissions/constants.ts` | +modulo 'accounting.opening-balances' |
| `src/shared/components/layout/_AppSidebar.tsx` | +nav item en Contabilidad |
| `src/modules/accounting/shared/utils/index.ts` | +ruta en revalidateAccountingRoutes |
| `docs/modules/accounting.md` | +seccion Saldos de Apertura |
| `docs/architecture/data-model.md` | +nota sobre patron apertura |

### Comportamiento Clave

| Operacion | Detalle |
|-----------|---------|
| Crear asiento apertura | JournalEntry POSTED, fecha=fiscalYearStart, bypass period lock |
| Editar asiento apertura | Borra lineas existentes y crea nuevas (no genera reversal) |
| Cuenta Apertura | Auto-creada como EQUITY 3.0.1 si no existe |
| Crear factura apertura | CONFIRMED sin journalEntryId, marcada con internalNotes='opening-balance' |
| Eliminar factura apertura | Solo si no tiene cobros/pagos asociados |
| Import Excel | Resuelve cliente/proveedor por nombre o CUIT, muestra errores por fila |


### Resumen de la Fase 2 - Saldos de Apertura
La implementación está completa. Aquí un resumen de lo realizado:

**Archivos creados (14)**
##### Feature module (src/modules/accounting/features/opening-balances/):

- actions.server.ts - 9 server actions (queries + mutations para asiento y facturas + import Excel)
- validators.ts - Schemas Zod
- types.ts - Tipos inferidos
- OpeningBalancesPage.tsx - Server Component con verificación de prerequisitos
- index.ts

##### Components (6 client components con prefijo _):

- _OpeningBalancesTabs - Layout con 3 tabs
- _AccountBalancesForm - Grilla de saldos agrupada por tipo, búsqueda, totales en tiempo real, línea de balanceo automática
- _PendingSalesInvoicesTab / _PendingPurchasesTab - Tabs con tabla, crear, eliminar, import Excel
- _CreateInvoiceDialog - Dialog compartido para crear factura simplificada
- _InvoiceImportDialog - Dialog de import Excel con plantilla descargable

##### Otros:

- invoices-excel-template.ts - Plantillas Excel
- page.tsx - Ruta
- opening-balances.cy.ts - Tests E2E

**Archivos modificados (5)**

- constants.ts - Nuevo permiso accounting.opening-balances
- _AppSidebar.tsx - Nav item en Contabilidad
- index.ts - Ruta en revalidateAccountingRoutes
- accounting.md - Documentación
- data-model.md - Nota sobre patrón

**Notas técnicas clave**

1. Sin modelo nuevo en Prisma - Usa JournalEntry + SalesInvoice/PurchaseInvoice existentes
2. Bypass period lock - El asiento de apertura puede tener fecha en período bloqueado
3. Edición sin reversal - Actualiza líneas directamente para no polucionar el libro diario
4. Marcador internalNotes='opening-balance' - Identifica facturas de apertura
5. Cuenta Apertura auto-creada - EQUITY 3.0.1 si no existe

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



# contexto de analisis

Análisis de Interacción: Nuevas Features vs Sistema Existente
1. Presupuestos y Control Presupuestario
Interacción con lo existente:

Plan de Cuentas: El presupuesto se define por cuenta contable + período. Ya tenés la estructura jerárquica de cuentas (Account con type y parentId), así que el presupuesto puede heredar la jerarquía (presupuesto por cuenta padre = suma de hijos).
Asientos Contables: El cálculo de "ejecutado" consulta las mismas JournalEntryLine con status POSTED que ya usan los reportes. La función getTrialBalance() ya calcula totales por cuenta y rango de fechas — la comparación budget vs real reutiliza esa lógica.
Cashflow/Proyecciones: Acá hay sinergia directa. Las proyecciones manuales (CashflowProjection con categorías SALARIES, TAXES, RENT, SERVICES) son esencialmente presupuestos de caja. Un módulo de presupuesto contable complementaría las proyecciones: el presupuesto es el plan devengado (contable), las proyecciones son el plan financiero (caja). Podría cruzarse: si el presupuesto de "Gastos de Alquiler" es $100k/mes, auto-generar la proyección de tipo RENT.
Gastos: Al confirmar un Expense que genera asiento, se podría validar contra el presupuesto de la cuenta expensesAccountId o la categoría de gasto, emitiendo alertas (warning, no bloqueante) si supera el % configurado.
Reportes: Un nuevo reporte de "Variación Presupuestaria" sería una extensión natural de los reportes existentes en reports/actions.server.ts, usando la misma lógica de filtrado por fecha y cuenta.
Modelo de datos necesario:


Budget              → companyId, accountId, fiscalYear, monthlyAmount[], totalAmount
BudgetRevision      → budgetId, date, previousAmount, newAmount, reason
Impacto en cashflow: Bajo. Solo agrega una fuente opcional de comparación. Las proyecciones manuales siguen siendo el mecanismo de cashflow.

2. Contabilidad Multi-Moneda
Interacción con lo existente:

Cuentas Bancarias: BankAccount ya tiene campo currency (default "ARS"). Hoy se ignora en la contabilización. Con multi-moneda, cada movimiento bancario en USD necesitaría registrar: monto en moneda origen + tipo de cambio + monto en moneda funcional (ARS).
Facturas de Venta/Compra: Las líneas (SalesInvoiceLine, PurchaseInvoiceLine) tienen montos en Decimal(12,2) sin campo de moneda. Habría que agregar currency y exchangeRate a nivel de factura, y el asiento automático convertiría a ARS usando ese tipo de cambio.
Asientos Contables: JournalEntryLine necesitaría campos opcionales currency, exchangeRate, amountInCurrency además del debit/credit que quedaría siempre en moneda funcional (ARS). Los reportes existentes seguirían funcionando sin cambios porque operan sobre debit/credit en ARS.
Recibos y Órdenes de Pago: Si un cobro se hace en USD, el ReceiptPayment necesita registrar moneda + tipo de cambio. La generación del asiento automático (createJournalEntryForReceipt) convertiría al tipo de cambio del día.
Cashflow: El dashboard de cashflow tendría que mostrar saldos separados por moneda, o convertir todo a ARS al tipo de cambio actual. Las proyecciones en moneda extranjera fluctuarían.
Diferencia de Cambio (Exchange Rate Revaluation): Al cierre de período, recalcular saldos de cuentas en moneda extranjera al tipo de cambio de cierre genera un asiento automático de diferencia de cambio. Esto impacta el cierre fiscal (closeFiscalYear) que necesitaría ejecutarse DESPUÉS de la revaluación.
Impacto en cashflow: Alto. Requiere tabla de tipos de cambio, conversión en proyecciones, y saldos bancarios en moneda original vs convertida. El currentBalance del cashflow tendría que sumar bancos ARS + bancos USD convertidos.

Complejidad: Es la feature más invasiva. Toca facturas, pagos, asientos, cashflow, reportes y cierre fiscal.

3. Bloqueo de Períodos Contables
Interacción con lo existente:

AccountingSettings: Ya tiene fiscalYearStart/fiscalYearEnd. Se agregaría un campo lockDate (DateTime?) — ningún asiento con fecha ≤ lockDate puede crearse/modificarse/postearse.
Validación de Asientos: La validación existente ya chequea que la fecha esté dentro del año fiscal. Agregar el check de lockDate es una línea más en el validador de entries/validators/.
Asientos Automáticos: Los 6 flujos de generación automática (createJournalEntryFor*) pasan por el mismo path de creación. La validación de lockDate los cubriría automáticamente. Pero hay que considerar: ¿qué pasa si un usuario intenta confirmar una factura de compra con fecha pasada (antes del lock)? El asiento fallaría. Como la generación de JE es non-critical (try-catch), la factura se confirmaría pero SIN asiento contable. Esto podría ser un problema de integridad.
Cierre Fiscal: El closeFiscalYear() debería automáticamente setear el lockDate al fiscalYearEnd del período cerrado.
Cashflow: Sin impacto directo. El cashflow trabaja con documentos comerciales (DRAFT, pendientes), no con asientos.
Proyecciones: Sin impacto.
Decisión de diseño crítica: Si se bloquea un período y alguien confirma una factura con fecha en ese período, el flujo actual la confirmaría sin asiento. Opciones:

Bloquear también la confirmación de documentos comerciales con fecha ≤ lockDate
Permitir el documento pero generar el asiento con fecha = lockDate + 1 (primer día hábil)
Mantener el comportamiento actual (documento sin asiento) y alertar
Impacto en cashflow: Nulo.

4. Ingresos y Gastos Diferidos
Interacción con lo existente:

Facturas de Venta: Una factura de venta de $120k por un contrato anual no debería reconocer los $120k como ingreso de una vez. Se necesita un flag en SalesInvoice o SalesInvoiceLine (isDeferred: true, deferredStartDate, deferredEndDate, deferredAccountId). El asiento inicial iría a una cuenta de Pasivo (ingreso diferido) en lugar de Ventas.
Facturas de Compra / Gastos: Mismo concepto. Un seguro anual de $60k se registra como Activo (gasto prepago) y se reconoce $5k/mes.
Asientos Recurrentes: El mecanismo de RecurringEntry ya existe y genera asientos periódicos. Los diferidos podrían reutilizar este motor: al confirmar una factura diferida, auto-crear un RecurringEntry que mueva monto de la cuenta diferida a la cuenta de ingreso/gasto real cada mes. Sin embargo, los diferidos tienen fecha de fin fija (el contrato termina), mientras que los recurrentes son indefinidos. Sería mejor un modelo separado.
Reportes: El Estado de Resultados (getIncomeStatement) automáticamente reflejaría solo los ingresos/gastos reconocidos en el período, porque lee de asientos POSTED. Los diferidos no reconocidos estarían en Balance General como pasivo/activo.
Cashflow: Un ingreso diferido ya fue cobrado (el cash entró). El cashflow no debería verse afectado porque ya registra el cobro vía recibo. Pero en el reporte contable, el ingreso se distribuye. No hay conflicto — cashflow y contabilidad miden cosas distintas.
Modelo de datos necesario:


DeferredSchedule    → documentType, documentId, totalAmount, accountId (deferred), 
                      revenueExpenseAccountId, startDate, endDate, frequency
DeferredEntry       → scheduleId, periodNumber, date, amount, isPosted, journalEntryId
Impacto en cashflow: Nulo. El cash ya se registra al cobrar/pagar. Los diferidos son ajustes puramente contables.

5. Dimensiones Contables Personalizables
Interacción con lo existente:

JournalEntryLine: Hoy NO tiene campo de CostCenter ni ninguna dimensión. Los centros de costo están en Employee y Vehicle. Para agregar dimensiones, hay que agregar campos a JournalEntryLine (ej: costCenterId, projectId, departmentId) o un modelo genérico JournalEntryLineDimension.
Asientos Automáticos: Los 6 flujos de createJournalEntryFor* necesitarían propagar dimensiones. Por ejemplo, si una factura de compra tiene un proveedor asignado a un centro de costo, las líneas del asiento heredarían esa dimensión. Esto requiere cambiar TODOS los generadores de asientos.
Reportes: Todos los reportes (getTrialBalance, getGeneralLedger, etc.) necesitarían un filtro opcional por dimensión. El General Ledger por centro de costo sería "mostrar solo movimientos de la cuenta X donde costCenterId = Y".
Cashflow: Sin impacto directo, a menos que se quiera ver cashflow por dimensión (ej: cashflow por sucursal). Esto agregaría complejidad significativa al getCashflowData() que ya agrega 7+ fuentes.
Presupuestos: Si se implementan presupuestos + dimensiones, el presupuesto se puede definir por cuenta + centro de costo + período, lo cual es mucho más potente.
Enfoque recomendado: Empezar con costCenterId opcional en JournalEntryLine (dimensión fija, no genérica). Esto cubre el 80% del caso de uso sin la complejidad de dimensiones dinámicas.

Impacto en cashflow: Bajo/nulo salvo que se quiera segmentar por dimensión.

6. Herramienta de Saldos de Apertura
Interacción con lo existente:

Plan de Cuentas: El wizard necesita que el plan de cuentas ya esté creado. Ya existe import de Excel, así que el flujo sería: 1) Importar plan → 2) Cargar saldos de apertura.
Asientos Contables: Los saldos de apertura se implementan como UN asiento contable con muchas líneas (una por cuenta con saldo). La contracuenta es una cuenta temporal "Apertura" de tipo EQUITY. Reutiliza completamente el motor de asientos existente.
Facturas Pendientes: Además de saldos contables, una migración necesita cargar facturas pendientes de cobro/pago del sistema anterior. Esto requiere crear SalesInvoice/PurchaseInvoice en status CONFIRMED directamente (sin generar asiento automático, porque el saldo ya se cargó en el asiento de apertura).
Cashflow: Las facturas pendientes migradas aparecerían automáticamente en el cashflow como cuentas por cobrar/pagar, porque getCashflowData() ya lee facturas CONFIRMED/PARTIAL_PAID.
Proyecciones: Sin impacto.
Impacto en cashflow: Positivo. Las facturas migradas alimentan automáticamente el cashflow sin trabajo extra.

7. Distribución de Costos entre Centros
Interacción con lo existente:

Requiere Dimensiones primero: Sin costCenterId en JournalEntryLine, no se puede distribuir nada. Esta feature depende de la #5.
Asientos Automáticos: Un gasto compartido (ej: alquiler $100k) generaría un asiento con múltiples líneas de débito: $40k a CC "Administración", $30k a CC "Logística", $30k a CC "Producción". El createJournalEntryForExpense() necesitaría recibir la distribución como parámetro.
Cashflow: El pago sigue siendo uno solo ($100k). La distribución es contable, no financiera. Sin impacto en cashflow.
Impacto en cashflow: Nulo.

8. Reglas Fiscales Automáticas
Interacción con lo existente:

Clientes/Proveedores: Contractor (clientes) y Supplier ya tienen taxCondition (campo que indica Responsable Inscripto, Monotributista, etc.). Las reglas usarían este campo para determinar automáticamente qué IVA aplicar.
Facturas: Al seleccionar un cliente en una factura de venta, la regla determinaría: si es RI → Factura A con IVA 21%, si es CF → Factura B con IVA incluido, etc. Esto reemplazaría la selección manual de voucherType y vatRate en cada línea.
Retenciones: Las reglas podrían determinar automáticamente qué retenciones aplicar en recibos/OP según el régimen del cliente/proveedor y los montos acumulados del período.
Cashflow: Sin impacto directo. Las reglas fiscales afectan la composición del monto (neto vs IVA) pero no el total a cobrar/pagar que alimenta el cashflow.
Proyecciones: Las proyecciones manuales son montos brutos. Si se quisiera descomponer una proyección en neto + IVA, las reglas fiscales podrían ayudar, pero esto es opcional.
Impacto en cashflow: Nulo.

Resumen de Impacto en Cashflow y Proyecciones
Feature	Impacto en Cashflow	Impacto en Proyecciones	Impacto en Asientos Auto
Presupuestos	Bajo (comparativo)	Sinergia (auto-generar)	Nulo
Multi-Moneda	Alto (conversión, saldos)	Alto (montos fluctuantes)	Alto (tipo de cambio)
Bloqueo Períodos	Nulo	Nulo	Medio (validación)
Diferidos	Nulo (cash ya registrado)	Nulo	Medio (asientos periódicos)
Dimensiones	Bajo (segmentación opcional)	Nulo	Alto (propagar a 6 flujos)
Saldos Apertura	Positivo (migra facturas)	Nulo	Bajo (asiento único)
Distribución Costos	Nulo	Nulo	Medio (requiere dimensiones)
Reglas Fiscales	Nulo	Nulo	Bajo (composición IVA)
Conclusión: La única feature que impacta fuertemente el cashflow existente es Multi-Moneda. Las demás son ortogonales o complementarias. El orden de implementación recomendado considerando dependencias sería:

Bloqueo de Períodos — mínimo esfuerzo, máximo valor de integridad
Saldos de Apertura — desbloquea adopción por empresas que migran
Presupuestos — reutiliza lógica existente de reportes, sinergia con proyecciones
Dimensiones (CostCenter en líneas) — habilita distribución y reportes analíticos
Diferidos — independiente, motor propio
Multi-Moneda — la más compleja, dejar para cuando el core esté consolidado
Reglas Fiscales — mejora UX pero no bloquea funcionalidad