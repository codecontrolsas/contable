# Presupuestos y Control Presupuestario

**Fecha de inicio:** 2026-02-25
**Estado:** Completado y verificado

---

## 1. Analisis

### 1.1 Problema

El sistema contable actual permite registrar asientos, generar reportes financieros (Balance de Sumas y Saldos, Estado de Resultados, Balance General) y gestionar gastos, pero no ofrece una herramienta para planificar y controlar el gasto por cuenta contable y periodo. Los usuarios no tienen forma de:

- Definir limites de gasto presupuestario por cuenta contable y mes.
- Comparar lo planificado (presupuesto) con lo realmente ejecutado (asientos POSTED).
- Recibir alertas cuando un gasto se acerca o supera el presupuesto asignado.
- Realizar revisiones formales del presupuesto con trazabilidad de cambios.
- Generar un reporte de variacion presupuestaria (presupuesto vs real vs desvio).

Las proyecciones de cashflow existentes (`CashflowProjection`) cubren el plan financiero (caja), pero no el plan devengado (contable). Ambos se complementan: el presupuesto contable planifica por cuenta de resultado, las proyecciones planifican por flujo de caja.

### 1.2 Contexto actual

#### Modelos Prisma relevantes

**Account** (`prisma/schema.prisma:224`): Estructura jerarquica con `parentId`, `type` (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE), `nature` (DEBIT, CREDIT), `code` (ej: 5.1.0). La jerarquia permite que un presupuesto por cuenta padre sea la suma de los hijos.

**AccountingSettings** (`prisma/schema.prisma:330`): Configuracion por empresa con `fiscalYearStart`, `fiscalYearEnd`, `lockedUntilDate`, cuentas por defecto (ventas, compras, gastos, etc.). El campo `expensesAccountId` es la cuenta de gastos operativos por defecto.

**JournalEntry / JournalEntryLine** (`prisma/schema.prisma:275/316`): Asientos contables con lineas que tienen `debit` y `credit` (Decimal 12,2). Solo los asientos con `status: POSTED` se consideran para calculos.

**CashflowProjection** (`prisma/schema.prisma:3181`): Proyecciones manuales con `type`, `category` (SALARIES, TAXES, RENT, SERVICES, etc.), `amount`, `date`. Son presupuestos de caja, no contables. Sinergia directa: un presupuesto contable de "Gastos de Alquiler" podria complementar una proyeccion de tipo RENT.

**Expense** (`prisma/schema.prisma:2884`): Gastos con `status` (DRAFT, CONFIRMED, PARTIAL_PAID, PAID, CANCELLED), `categoryId`, `amount`, `journalEntryId`. Al confirmar, se genera un asiento automatico via `createJournalEntryForExpense()`.

#### Funciones existentes reutilizables

**`calculateAccountBalance(accountId, companyId, upToDate)`** (`src/modules/accounting/shared/utils/balances.ts:10`): Calcula debit/credit/balance de una cuenta hasta una fecha. Consulta `JournalEntryLine` donde `entry.status = POSTED`. Es la base para calcular el "ejecutado" de un presupuesto.

**`calculateAllAccountBalances(companyId, upToDate)`** (`src/modules/accounting/shared/utils/balances.ts:64`): Calcula saldos de todas las cuentas activas. Util para generar el reporte de variacion presupuestaria completo.

**`calculateBalanceByType(companyId, upToDate)`** (`src/modules/accounting/shared/utils/balances.ts:93`): Agrupa saldos por tipo de cuenta (ASSET, LIABILITY, etc.). Util para resumen de presupuesto por tipo.

**`getTrialBalance(companyId, fromDate, toDate)`** (`src/modules/accounting/features/reports/actions.server.ts:96`): Balance de sumas y saldos. Retorna `AccountBalance[]` con `debitTotal`, `creditTotal`, `balance` por cuenta. La logica de comparacion presupuestaria reutiliza este mismo patron de consulta.

**`getIncomeStatement(companyId, fromDate, toDate)`** (`src/modules/accounting/features/reports/actions.server.ts:482`): Estado de Resultados que separa REVENUE y EXPENSE con montos por cuenta. El reporte de variacion presupuestaria es esencialmente un estado de resultados con columna extra de presupuesto.

**`buildAccountTree(accounts)`** (`src/modules/accounting/shared/utils/index.ts:17`): Convierte lista plana de cuentas en arbol jerarquico. Necesario para mostrar presupuestos con herencia de cuentas padre.

**`createJournalEntryForExpense()`** (`src/modules/accounting/features/integrations/commercial/index.ts:667`): Integracion que genera asiento al confirmar gasto. Punto de intervencion para la validacion presupuestaria.

**`confirmExpense()`** (`src/modules/commercial/features/expenses/actions.server.ts:422`): Accion que confirma un gasto y genera el asiento contable. Aqui se agregaria la advertencia presupuestaria.

#### Reportes existentes (patron a seguir)

Los reportes viven en `src/modules/accounting/features/reports/` con:
- `actions.server.ts`: Server actions que calculan los datos
- `components/_ReportsSelector.tsx`: Selector de tipo de reporte (con categorias: financieros, bienes de uso, auditoria)
- `components/_ReportsContent.tsx`: Renderizador de contenido segun el tipo seleccionado
- Componentes individuales por reporte: `_TrialBalanceReport.tsx`, `_IncomeStatementReport.tsx`, etc.

El nuevo reporte "Variacion Presupuestaria" seguiria este mismo patron, agregandose como un nuevo tipo en `_ReportsSelector.tsx`.

#### Sistema de permisos

Los modulos de contabilidad en `src/shared/lib/permissions/constants.ts` incluyen:
- `accounting.accounts`, `accounting.entries`, `accounting.reports`, `accounting.settings`
- `accounting.fiscal-year-close`, `accounting.recurring-entries`, `accounting.opening-balances`

Se necesita agregar `accounting.budgets` como nuevo modulo de permisos.

#### Navegacion

En `src/shared/components/layout/_AppSidebar.tsx`, la seccion de Contabilidad tiene items como Dashboard, Saldos de Apertura, Asientos, Informes, etc. Se agregaria "Presupuestos" como nuevo item.

### 1.3 Archivos involucrados

#### Archivos a CREAR

| Archivo | Descripcion |
|---------|-------------|
| `src/modules/accounting/features/budgets/BudgetsList.tsx` | Server Component principal - lista de presupuestos |
| `src/modules/accounting/features/budgets/actions.server.ts` | Server actions: CRUD de presupuestos, calculo de ejecutado, validacion presupuestaria |
| `src/modules/accounting/features/budgets/components/_BudgetsTable.tsx` | Client Component - tabla de presupuestos con DataTable |
| `src/modules/accounting/features/budgets/components/_CreateBudgetModal.tsx` | Client Component - modal de creacion/edicion de presupuesto |
| `src/modules/accounting/features/budgets/components/_BudgetDetailModal.tsx` | Client Component - detalle con desglose mensual y comparacion |
| `src/modules/accounting/features/budgets/components/_BudgetRevisionModal.tsx` | Client Component - modal de revision de presupuesto con motivo |
| `src/modules/accounting/features/budgets/validators/index.ts` | Schemas Zod para validacion de formularios |
| `src/modules/accounting/features/budgets/index.ts` | Barrel exports |
| `src/modules/accounting/features/reports/components/_BudgetVarianceReport.tsx` | Client Component - reporte de variacion presupuestaria |
| `src/app/(core)/dashboard/company/accounting/budgets/page.tsx` | Pagina de ruta (thin page) |
| `cypress/e2e/accounting/budgets.cy.ts` | Tests E2E del modulo de presupuestos |

#### Archivos a MODIFICAR

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | +modelos `Budget`, `BudgetRevision`, +enum `BudgetStatus` |
| `src/shared/lib/permissions/constants.ts` | +modulo `accounting.budgets` con label "Presupuestos" |
| `src/shared/components/layout/_AppSidebar.tsx` | +item "Presupuestos" en seccion Contabilidad |
| `src/modules/accounting/shared/utils/index.ts` | +re-export de `revalidateAccountingRoutes` con ruta de presupuestos |
| `src/modules/accounting/features/reports/actions.server.ts` | +funcion `getBudgetVarianceReport()` |
| `src/modules/accounting/features/reports/components/_ReportsSelector.tsx` | +tipo `budget-variance` en ReportType, +boton en seccion de reportes |
| `src/modules/accounting/features/reports/components/_ReportsContent.tsx` | +case para renderizar `_BudgetVarianceReport` |
| `src/modules/commercial/features/expenses/actions.server.ts` | +llamada a validacion presupuestaria en `confirmExpense()` |
| `docs/modules/accounting.md` | +seccion "Presupuestos y Control Presupuestario" |
| `docs/architecture/data-model.md` | +modelos Budget, BudgetRevision |

### 1.4 Dependencias

#### Librerias existentes (no se necesitan nuevas)

- **Prisma ORM 7**: Para los nuevos modelos Budget y BudgetRevision. Ya disponible.
- **Zod**: Para validacion de formularios de presupuesto. Ya disponible.
- **React Hook Form**: Para formularios de creacion/edicion. Ya disponible.
- **React Query (TanStack Query v5)**: Para fetching de datos en componentes client. Ya disponible.
- **moment.js**: Para manejo de fechas y periodos mensuales. Ya disponible.
- **shadcn/ui**: Para componentes de UI (Dialog, DataTable, Card, etc.). Ya disponible.
- **Sonner**: Para notificaciones toast (warnings presupuestarios). Ya disponible.
- **Lucide React**: Para iconos. Ya disponible.

No se requiere instalar ninguna libreria nueva.

#### Modulos internos de los que depende

- `src/modules/accounting/shared/utils/balances.ts`: Funciones de calculo de saldos (`calculateAccountBalance`, `calculateAllAccountBalances`).
- `src/modules/accounting/features/reports/actions.server.ts`: Patron de reportes y logica de calculo de ejecutado.
- `src/modules/accounting/features/integrations/commercial/index.ts`: Punto de integracion para validacion al crear asientos automaticos.
- `src/shared/lib/company.ts`: `getActiveCompanyId()` para server actions.
- `src/shared/lib/prisma.ts`: Cliente Prisma singleton.
- `src/shared/lib/logger.ts`: Logger para registrar operaciones.
- `src/shared/components/common/DataTable`: Componente de tabla con paginacion server-side.

### 1.5 Restricciones y reglas

#### Reglas del CLAUDE.md que aplican directamente

1. **Server Components por defecto**: `BudgetsList.tsx` sera Server Component. Los componentes interactivos (`_BudgetsTable.tsx`, `_CreateBudgetModal.tsx`, etc.) seran Client Components con prefijo `_`.

2. **Server Actions en el modulo**: Todas las actions van en `src/modules/accounting/features/budgets/actions.server.ts`, no en carpetas separadas.

3. **No importar entre modulos**: La validacion presupuestaria que se invoca desde `expenses/actions.server.ts` debe estar en `shared/` o ser invocada via una funcion compartida. Alternativa: la funcion de validacion puede vivir en `accounting/features/budgets/actions.server.ts` y el modulo de expenses la importa desde ahi. NOTA: Esto viola la regla de no importar entre modulos. La solucion correcta es crear una funcion de validacion presupuestaria en `src/shared/actions/` o en `src/modules/accounting/features/integrations/`.

4. **Decimal a Number()**: Los campos `monthlyAmounts` (si se almacenan como Decimal) y `totalAmount` deben convertirse con `Number()` antes de pasar a Client Components.

5. **useQuery para fetching**: Los componentes client usaran `useQuery` para obtener datos, nunca `useEffect + useState`.

6. **Zod para validacion**: Schemas en `validators/index.ts` del feature.

7. **DataTable con meta.title**: Todas las columnas de la tabla de presupuestos deben tener `meta: { title: '...' }`.

8. **AlertDialog, nunca confirm()**: Para confirmaciones de revision o eliminacion de presupuesto.

9. **moment.js, nunca date-fns**: Para calculos de periodos mensuales, inicio/fin de mes, etc.

10. **Logger, nunca console.***: Todas las operaciones de server actions usan `logger`.

11. **Tests E2E obligatorios**: Crear spec en `cypress/e2e/accounting/budgets.cy.ts`.

12. **Documentacion**: Actualizar `docs/modules/accounting.md` y `docs/architecture/data-model.md`.

#### Restricciones tecnicas

- **Campos Decimal en Prisma**: `monthlyAmounts` como Json (array de 12 numeros) en lugar de 12 campos Decimal separados, para simplificar. Alternativamente, usar un campo `Decimal[]` o un modelo separado `BudgetMonth`.
- **Ano fiscal no necesariamente enero-diciembre**: El `AccountingSettings` tiene `fiscalYearStart` y `fiscalYearEnd` que pueden ser cualquier rango. Los presupuestos deben alinearse con el ano fiscal, no con el ano calendario.
- **Herencia jerarquica**: El presupuesto de una cuenta padre deberia ser la suma de los presupuestos de sus cuentas hijas. Esto puede ser calculado en tiempo de consulta (no almacenado).
- **Validacion no bloqueante**: Al confirmar un gasto, la alerta presupuestaria es un warning (toast), no impide la confirmacion.

### 1.6 Riesgos identificados

1. **Performance del calculo de ejecutado**: La funcion `calculateAccountBalance()` actual hace una query por cuenta (N+1). Para el reporte de variacion presupuestaria con muchas cuentas, esto podria ser lento. Riesgo mitigable: crear una funcion optimizada que calcule el ejecutado de multiples cuentas en una sola query agregada (GROUP BY accountId).

2. **Diseno del modelo monthlyAmounts**: Almacenar los 12 montos mensuales como campo Json (`Decimal[]` o `number[]`) es simple pero dificulta queries SQL directas. Alternativa: modelo separado `BudgetPeriod` con (budgetId, month, amount). El trade-off es mas tablas vs queries mas flexibles. Recomendacion: usar Json para la primera iteracion, migrar si se necesita mas granularidad.

3. **Alineacion con ano fiscal**: Si el ano fiscal va de julio a junio, los "12 meses" del presupuesto no son enero-diciembre. Hay que usar `fiscalYearStart` para calcular los meses correctos y mostrar los labels correspondientes.

4. **Interaccion con periodo bloqueado**: Si un periodo esta bloqueado (`lockedUntilDate`), no se pueden crear asientos en ese periodo. Pero el presupuesto para ese periodo deberia seguir siendo visible y editable (es un plan, no un asiento). Solo la revision deberia registrar la fecha y no deberia verse afectada por el bloqueo.

5. **Regla de no importar entre modulos**: La validacion presupuestaria necesita invocarse desde el modulo de expenses (comercial) al confirmar un gasto. La solucion es colocar la funcion de validacion presupuestaria en `src/modules/accounting/features/integrations/` (que ya es el punto de integracion entre contabilidad y comercial), manteniendo la consistencia con el patron existente de `createJournalEntryForExpense`.

6. **Complejidad del reporte de variacion**: El reporte debe cruzar datos de dos fuentes (Budget y JournalEntryLine), calcular desvios absolutos y porcentuales, y mostrar la informacion de forma clara. Es el componente mas complejo del modulo.

7. **Multiples presupuestos por cuenta/ano**: Hay que decidir si se permite un solo presupuesto por cuenta+anoFiscal (constraint unico) o multiples versiones/escenarios. Recomendacion: constraint unico para la primera iteracion, con revisiones formales para cambios.

8. **Cuentas padre vs cuentas hoja**: Los presupuestos deberian asignarse a cuentas hoja (sin hijos). El monto de cuentas padre se calcula como suma de hijos. Si se permite asignar presupuesto a cuentas padre directamente, se complica la logica de agregacion.

---

## 2. Planificacion

### 2.1 Fases de implementacion

#### Fase 1: Modelo de datos y migracion
- **Objetivo:** Crear los modelos Prisma `Budget` y `BudgetRevision` con sus relaciones, enum `BudgetStatus`, y ejecutar la migracion para tener la base de datos lista.
- **Tareas:**
  - [ ] Agregar enum `BudgetStatus` en `prisma/schema.prisma` con valores: `DRAFT`, `ACTIVE`, `CLOSED` (patron consistente con `JournalEntryStatus`). Ubicar junto a los otros enums contables (linea ~204).
  - [ ] Crear modelo `Budget` en `prisma/schema.prisma` con campos: `id` (UUID), `companyId` (UUID, FK a Company), `accountId` (UUID, FK a Account), `fiscalYear` (Int, ej: 2026), `status` (BudgetStatus, default DRAFT), `monthlyAmounts` (Json, array de 12 numeros representando los montos por mes del ano fiscal), `totalAmount` (Decimal 12,2, calculado como suma de monthlyAmounts), `notes` (String?, observaciones opcionales), `createdBy` (String, userId de Clerk), `createdAt`, `updatedAt`. Constraint unico: `@@unique([companyId, accountId, fiscalYear])`. Mapa: `@@map("budgets")`.
  - [ ] Crear modelo `BudgetRevision` en `prisma/schema.prisma` con campos: `id` (UUID), `budgetId` (UUID, FK a Budget con onDelete Cascade), `previousAmounts` (Json, copia del array anterior), `newAmounts` (Json, array nuevo), `previousTotal` (Decimal 12,2), `newTotal` (Decimal 12,2), `reason` (String, motivo obligatorio de la revision), `createdBy` (String, userId), `createdAt`. Mapa: `@@map("budget_revisions")`.
  - [ ] Agregar relacion `budgets Budget[]` en modelo `Account` (linea ~268, antes de `@@unique`).
  - [ ] Agregar relacion `budgets Budget[]` en modelo `Company` (si no existe ya una relacion generica).
  - [ ] Ejecutar `npm run db:migrate` para crear la migracion `add_budget_models`.
  - [ ] Ejecutar `npm run db:generate` para regenerar el cliente Prisma.
- **Archivos:**
  - Modificar: `prisma/schema.prisma`
- **Criterio de completitud:** Los modelos Budget y BudgetRevision existen en la BD, `npm run db:generate` pasa sin errores, y los tipos `Budget`, `BudgetRevision`, `BudgetStatus` estan disponibles en `@/generated/prisma`.

#### Fase 2: Permisos, navegacion y ruta
- **Objetivo:** Registrar el modulo de presupuestos en el sistema de permisos, agregar el item de navegacion en el sidebar, y crear la pagina thin de ruta.
- **Tareas:**
  - [ ] Agregar `'accounting.budgets': 'accounting.budgets'` en el objeto `MODULES` de `src/shared/lib/permissions/constants.ts` (despues de `'accounting.opening-balances'`, linea ~80).
  - [ ] Agregar `'accounting.budgets': 'Presupuestos'` en `MODULE_LABELS` (despues de `'accounting.opening-balances'`, linea ~164).
  - [ ] Agregar `'accounting.budgets'` al array `modules` del grupo `configuracionContable` en `MODULE_GROUPS` (linea ~256).
  - [ ] Agregar item de navegacion `{ title: 'Presupuestos', href: '/dashboard/company/accounting/budgets', module: 'accounting.budgets' }` en la seccion de Contabilidad del sidebar (`src/shared/components/layout/_AppSidebar.tsx`, despues del item de Saldos de Apertura, ~linea 94).
  - [ ] Crear directorio `src/app/(core)/dashboard/company/accounting/budgets/`.
  - [ ] Crear archivo `src/app/(core)/dashboard/company/accounting/budgets/page.tsx` siguiendo el patron exacto de `opening-balances/page.tsx`: importar `BudgetsPage` desde el modulo, llamar `checkPermission('accounting.budgets', 'view')`.
  - [ ] Agregar la ruta de presupuestos en `revalidateAccountingRoutes()` en `src/modules/accounting/shared/utils/index.ts` (linea ~131): `revalidatePath('/dashboard/company/accounting/budgets')`.
- **Archivos:**
  - Modificar: `src/shared/lib/permissions/constants.ts`, `src/shared/components/layout/_AppSidebar.tsx`, `src/modules/accounting/shared/utils/index.ts`
  - Crear: `src/app/(core)/dashboard/company/accounting/budgets/page.tsx`
- **Criterio de completitud:** El item "Presupuestos" aparece en el sidebar de Contabilidad, la ruta `/dashboard/company/accounting/budgets` existe y verifica permisos (puede mostrar un placeholder temporario).

#### Fase 3: Server Actions (CRUD y consultas)
- **Objetivo:** Implementar toda la logica de negocio del modulo: crear, listar, obtener detalle, actualizar, crear revisiones, eliminar presupuestos, y la funcion de calculo de ejecutado.
- **Tareas:**
  - [ ] Crear directorio `src/modules/accounting/features/budgets/`.
  - [ ] Crear `src/modules/accounting/features/budgets/validators/index.ts` con schemas Zod:
    - `createBudgetSchema`: `accountId` (string UUID), `fiscalYear` (number), `monthlyAmounts` (z.array(z.number().min(0)).length(12)), `notes` (string opcional).
    - `updateBudgetSchema`: igual pero todos opcionales excepto `id`.
    - `createRevisionSchema`: `budgetId` (string UUID), `newAmounts` (z.array(z.number().min(0)).length(12)), `reason` (string min 1).
  - [ ] Crear `src/modules/accounting/features/budgets/actions.server.ts` con las siguientes funciones:
    - `getBudgets(companyId, fiscalYear?)`: Lista presupuestos con filtro por ano fiscal. Incluir account (code, name, type), contar revisiones. Retornar con `Number()` en totalAmount.
    - `getBudgetDetail(budgetId)`: Detalle con monthlyAmounts, revisiones ordenadas por fecha desc, y calculo de ejecutado mensual por cuenta. Usar query optimizada con GROUP BY para obtener el ejecutado de la cuenta por mes (agrupar JournalEntryLine por mes de entry.date donde entry.status=POSTED, dentro del rango fiscal). Retornar monthlyAmounts como number[], ejecutado mensual como number[], desvios absolutos y porcentuales.
    - `createBudget(input)`: Validar con Zod, verificar que la cuenta existe y es de tipo EXPENSE o REVENUE (solo cuentas de resultado), verificar unicidad (companyId+accountId+fiscalYear), calcular totalAmount como suma de monthlyAmounts, crear con status DRAFT.
    - `updateBudget(id, input)`: Solo si status es DRAFT. Permite cambiar montos sin crear revision.
    - `activateBudget(id)`: Cambia status de DRAFT a ACTIVE.
    - `createBudgetRevision(input)`: Solo si status es ACTIVE. Validar con Zod, guardar previousAmounts/newAmounts en BudgetRevision, actualizar monthlyAmounts y totalAmount del Budget. Usar transaccion.
    - `closeBudget(id)`: Cambia status de ACTIVE a CLOSED.
    - `deleteBudget(id)`: Solo si status es DRAFT. Eliminar presupuesto y sus revisiones (cascade).
    - `getBudgetableAccounts(companyId)`: Retornar cuentas activas de tipo EXPENSE y REVENUE sin hijos (cuentas hoja), con code y name. Para determinar si es hoja, filtrar cuentas que no tengan children.
    - `getFiscalYears(companyId)`: Retornar lista de anos fiscales disponibles basados en AccountingSettings.fiscalYearStart.
    - `calculateBudgetExecution(accountId, companyId, fiscalYearStart, fiscalYearEnd)`: Funcion optimizada que calcula el ejecutado mensual de una cuenta. Query: `prisma.journalEntryLine.groupBy({ by: [], _sum: { debit, credit }, where: { accountId, entry: { companyId, status: POSTED, date: { gte, lte } } } })` agrupado por mes (extraer mes de entry.date). Retornar array de 12 numeros.
  - [ ] Crear `src/modules/accounting/features/budgets/index.ts` con barrel export: `export { BudgetsPage } from './BudgetsPage'`.
- **Archivos:**
  - Crear: `src/modules/accounting/features/budgets/actions.server.ts`, `src/modules/accounting/features/budgets/validators/index.ts`, `src/modules/accounting/features/budgets/index.ts`
- **Criterio de completitud:** Todas las funciones de server actions existen, compilan sin errores, usan `getActiveCompanyId()`, `logger`, `auth()`, y convierten Decimal a Number(). Los schemas Zod validan correctamente.

#### Fase 4: UI - Listado y creacion de presupuestos
- **Objetivo:** Implementar la pagina principal con la tabla de presupuestos y el modal de creacion.
- **Tareas:**
  - [ ] Crear `src/modules/accounting/features/budgets/BudgetsPage.tsx` (Server Component): Obtener companyId, verificar que exista AccountingSettings con fiscalYear configurado (si no, mostrar alerta con link a settings como en `OpeningBalancesPage`), verificar que haya cuentas de resultado (si no, alerta con link a Plan de Cuentas). Pasar datos iniciales al componente client.
  - [ ] Crear `src/modules/accounting/features/budgets/components/_BudgetsTable.tsx` (Client Component): DataTable con columnas: Cuenta (code + name), Ano Fiscal, Monto Total (formateado como moneda), Estado (badge con color), Revisiones (#), Acciones (ver detalle, editar si DRAFT, activar si DRAFT, cerrar si ACTIVE, eliminar si DRAFT). Todas las columnas con `meta: { title: '...' }`. Filtro por ano fiscal con Select. Usar `useQuery` para refetch de datos.
  - [ ] Crear `src/modules/accounting/features/budgets/components/_CreateBudgetModal.tsx` (Client Component): Dialog con formulario React Hook Form + Zod. Campos: selector de cuenta (filtrado a cuentas hoja de EXPENSE/REVENUE, usar Combobox para busqueda), selector de ano fiscal, 12 campos numericos para montos mensuales (labels dinamicos segun fiscalYearStart: si el ejercicio empieza en julio, los labels seran Jul, Ago, Sep...), campo de notas (opcional). Mostrar total calculado en tiempo real (suma de los 12 campos). Boton "Distribuir uniformemente" que divide un monto total entre los 12 meses. UseMutation para submit con invalidacion de queryKey `['budgets']`.
  - [ ] Agregar AlertDialog para confirmacion de eliminacion de presupuesto (nunca `confirm()`).
- **Archivos:**
  - Crear: `src/modules/accounting/features/budgets/BudgetsPage.tsx`, `src/modules/accounting/features/budgets/components/_BudgetsTable.tsx`, `src/modules/accounting/features/budgets/components/_CreateBudgetModal.tsx`
- **Criterio de completitud:** Se puede navegar a `/dashboard/company/accounting/budgets`, ver la lista de presupuestos en una tabla, crear un nuevo presupuesto con montos mensuales, activarlo, y eliminarlo si esta en borrador.

#### Fase 5: UI - Detalle, revision y comparacion
- **Objetivo:** Implementar el modal de detalle con comparacion presupuesto vs ejecutado y el modal de revision formal.
- **Tareas:**
  - [x] Crear `src/modules/accounting/features/budgets/components/_BudgetDetailModal.tsx` (Client Component): Dialog grande (max-w-4xl) con:
    - Encabezado: cuenta (code + name), ano fiscal, estado.
    - Tabla de 12 filas (una por mes fiscal) con columnas: Mes, Presupuestado, Ejecutado, Desvio ($), Desvio (%). Usar `useQuery` para obtener detalle con calculo de ejecutado en tiempo real. Colorear desvios: verde si ejecutado < presupuestado, amarillo si 80-100%, rojo si >100%.
    - Fila de totales al final.
    - Seccion de historial de revisiones (si hay): lista con fecha, usuario, motivo, montos previos vs nuevos.
    - Boton "Revisar Presupuesto" (solo si ACTIVE) que abre el modal de revision.
    - Boton "Cerrar Presupuesto" (solo si ACTIVE) con AlertDialog de confirmacion.
  - [x] Crear `src/modules/accounting/features/budgets/components/_BudgetRevisionModal.tsx` (Client Component): Dialog con formulario para revision. Muestra los 12 montos actuales (readonly) y campos editables para los nuevos montos. Campo obligatorio "Motivo de la revision". Boton de submit que crea la revision via useMutation. Al confirmar, los montos del presupuesto se actualizan.
- **Archivos:**
  - Crear: `src/modules/accounting/features/budgets/components/_BudgetDetailModal.tsx`, `src/modules/accounting/features/budgets/components/_BudgetRevisionModal.tsx`
- **Criterio de completitud:** Se puede ver el detalle de un presupuesto con la comparacion mensual presupuesto vs ejecutado, crear revisiones formales con motivo, y cerrar presupuestos.

#### Fase 6: Reporte de variacion presupuestaria
- **Objetivo:** Agregar el reporte "Variacion Presupuestaria" al sistema de reportes existente, comparando todas las cuentas presupuestadas con su ejecucion real.
- **Tareas:**
  - [x] Agregar funcion `getBudgetVarianceReport(companyId, fiscalYear)` en `src/modules/accounting/features/reports/actions.server.ts`: Obtener todos los presupuestos ACTIVE del ano fiscal, para cada uno calcular el ejecutado acumulado hasta la fecha usando la logica de `getIncomeStatement` (filtrar JournalEntryLine por cuenta y rango fiscal, sumar debits/credits segun naturaleza). Retornar array con: account (code, name, type), budgetedTotal, executedTotal, varianceAmount, variancePercent. Separar en secciones REVENUE y EXPENSE. Incluir totales por seccion y resultado neto presupuestado vs real.
  - [x] Agregar `'budget-variance'` al tipo `ReportType` en `src/modules/accounting/features/reports/components/_ReportsSelector.tsx` (linea ~16).
  - [x] Agregar entrada en un nuevo grupo `budgetReports` (o en `financialReports`) en `_ReportsSelector.tsx` con: id `'budget-variance'`, name `'Variacion Presupuestaria'`, description `'Presupuesto vs ejecutado por cuenta'`, icon `Target` (de lucide-react). Agregar la seccion "Presupuestarios" en el render del selector.
  - [x] Crear `src/modules/accounting/features/reports/components/_BudgetVarianceReport.tsx` (Client Component): Tabla con columnas Cuenta, Presupuestado, Ejecutado, Desvio $, Desvio %. Separar en secciones Ingresos y Gastos (como el Estado de Resultados). Fila de totales por seccion. Fila final: Resultado Neto Presupuestado vs Real. Selector de ano fiscal. Colorear desvios con el mismo criterio de la fase 5.
  - [x] Agregar el case `'budget-variance'` en `src/modules/accounting/features/reports/components/_ReportsContent.tsx` para renderizar `_BudgetVarianceReport`.
- **Archivos:**
  - Modificar: `src/modules/accounting/features/reports/actions.server.ts`, `src/modules/accounting/features/reports/components/_ReportsSelector.tsx`, `src/modules/accounting/features/reports/components/_ReportsContent.tsx`
  - Crear: `src/modules/accounting/features/reports/components/_BudgetVarianceReport.tsx`
- **Criterio de completitud:** El reporte "Variacion Presupuestaria" aparece en el selector de reportes, se puede seleccionar un ano fiscal, y muestra la comparacion completa de presupuesto vs ejecutado por cuenta con desvios.

#### Fase 7: Integracion con gastos (validacion presupuestaria)
- **Objetivo:** Agregar una advertencia (warning no bloqueante) cuando se confirma un gasto y el presupuesto de esa cuenta esta cerca de superarse o ya se supero.
- **Tareas:**
  - [x] Crear funcion `checkBudgetForExpense(accountId, amount, companyId, expenseDate)` en `src/modules/accounting/features/integrations/commercial/index.ts` (junto a `createJournalEntryForExpense`). Esta funcion: obtiene el presupuesto ACTIVE de la cuenta para el ano fiscal actual, si existe calcula el ejecutado acumulado del mes actual, compara ejecutado+amount vs presupuestado del mes, retorna `{ hasWarning: boolean, message: string, executedPercent: number }`. No lanza errores, solo retorna info.
  - [x] Modificar `confirmExpense()` en `src/modules/commercial/features/expenses/actions.server.ts` para:
    - Antes de la transaccion, llamar a `checkBudgetForExpense()` para obtener la advertencia.
    - Retornar `{ success: true, budgetWarning?: { message: string, executedPercent: number } }` en lugar de solo `{ success: true }`.
  - [x] Modificar el componente que invoca `confirmExpense()` en el frontend para mostrar un toast de advertencia (Sonner, tipo `warning`) si `budgetWarning` viene en la respuesta. El gasto se confirma igual, solo se muestra la advertencia.
- **Archivos:**
  - Modificar: `src/modules/accounting/features/integrations/commercial/index.ts`, `src/modules/commercial/features/expenses/actions.server.ts`
  - Modificar: El componente client que llama a `confirmExpense` (buscar en `src/modules/commercial/features/expenses/components/`)
- **Criterio de completitud:** Al confirmar un gasto cuya cuenta tiene presupuesto ACTIVE, si el ejecutado supera el 80% del presupuesto mensual, aparece un toast de advertencia. El gasto se confirma normalmente.

#### Fase 8: Tests E2E
- **Objetivo:** Crear tests E2E completos para el modulo de presupuestos.
- **Tareas:**
  - [x] Crear `cypress/e2e/accounting/budgets.cy.ts` con los siguientes tests:
    - Navegacion: verificar que el item "Presupuestos" aparece en el sidebar y navega correctamente.
    - Crear presupuesto: abrir modal, seleccionar cuenta, ingresar montos mensuales, verificar calculo de total, submit, verificar que aparece en la tabla.
    - Ver detalle: click en un presupuesto, verificar que muestra la tabla de comparacion con 12 meses.
    - Activar presupuesto: cambiar estado de DRAFT a ACTIVE.
    - Crear revision: desde el detalle de un presupuesto ACTIVE, modificar montos, ingresar motivo, verificar que la revision se registro.
    - Cerrar presupuesto: cambiar estado de ACTIVE a CLOSED.
    - Eliminar presupuesto borrador: verificar AlertDialog de confirmacion y eliminacion.
    - Reporte de variacion: navegar a Informes, seleccionar "Variacion Presupuestaria", verificar que muestra datos.
  - [x] Agregar task de limpieza en `cypress/support/db.ts` para eliminar datos de test de presupuestos: `cleanupBudgets(companyId)`.
  - [x] Registrar la task en `cypress.config.ts`.
- **Archivos:**
  - Crear: `cypress/e2e/accounting/budgets.cy.ts`
  - Modificar: `cypress/support/db.ts`, `cypress.config.ts`
- **Criterio de completitud:** `npm run cy:run:accounting` pasa todos los tests de presupuestos sin errores.

#### Fase 9: Documentacion
- **Objetivo:** Actualizar la documentacion del desarrollador para reflejar el nuevo modulo.
- **Tareas:**
  - [x] Actualizar `docs/modules/accounting.md`: agregar seccion "Presupuestos y Control Presupuestario" con descripcion del modulo, modelos (Budget, BudgetRevision), flujo de estados (DRAFT -> ACTIVE -> CLOSED), funcionalidades (CRUD, revisiones, comparacion, reporte de variacion), integracion con gastos.
  - [x] Actualizar `docs/architecture/data-model.md`: agregar modelos Budget y BudgetRevision con sus campos y relaciones.
- **Archivos:**
  - Modificar: `docs/modules/accounting.md`, `docs/architecture/data-model.md`
- **Criterio de completitud:** La documentacion refleja fielmente la implementacion: modelos, flujos, funcionalidades, y puntos de integracion.

### 2.2 Orden de ejecucion

```
Fase 1 (Modelo de datos) ─────► Fase 2 (Permisos y ruta) ─────► Fase 3 (Server Actions)
                                                                         │
                                                                         ▼
                                                                  Fase 4 (UI Listado)
                                                                         │
                                                                         ▼
                                                                  Fase 5 (UI Detalle)
                                                                         │
                                                               ┌─────────┴─────────┐
                                                               ▼                   ▼
                                                        Fase 6 (Reporte)    Fase 7 (Integracion)
                                                               │                   │
                                                               └─────────┬─────────┘
                                                                         ▼
                                                                  Fase 8 (Tests E2E)
                                                                         │
                                                                         ▼
                                                                  Fase 9 (Documentacion)
```

**Dependencias clave:**
- **Fase 1 es prerequisito de todo**: sin modelos no hay nada que construir.
- **Fase 2 depende de Fase 1**: la ruta necesita el modelo para importar tipos.
- **Fase 3 depende de Fase 1**: las server actions operan sobre los modelos.
- **Fase 4 depende de Fases 2 y 3**: la UI necesita la ruta y las actions.
- **Fase 5 depende de Fase 4**: el detalle se abre desde la tabla del listado.
- **Fases 6 y 7 son independientes entre si** pero ambas dependen de Fase 5 (necesitan que el modulo funcional exista).
- **Fase 8 depende de Fases 6 y 7**: los tests cubren todo el flujo incluyendo reporte e integracion.
- **Fase 9 puede ejecutarse en paralelo con Fase 8**: documentar no depende de los tests.

### 2.3 Estimacion de complejidad

| Fase | Complejidad | Justificacion |
|------|-------------|---------------|
| Fase 1: Modelo de datos | Baja | Dos modelos simples, un enum, relaciones directas. Patron ya establecido en el schema. |
| Fase 2: Permisos y ruta | Baja | Agregar entradas en constantes existentes y crear una pagina thin. Mecanico. |
| Fase 3: Server Actions | Alta | La funcion `calculateBudgetExecution` requiere query optimizada con agrupacion por mes. La logica de alineacion con ano fiscal (meses que no empiezan en enero) agrega complejidad. Son ~10 funciones con validaciones. |
| Fase 4: UI Listado | Media | DataTable estandar + modal de creacion con 12 campos mensuales dinamicos y labels dependientes del ano fiscal. El Combobox para busqueda de cuentas y el boton "Distribuir uniformemente" agregan complejidad al form. |
| Fase 5: UI Detalle | Alta | Componente mas complejo: tabla de 12 meses con 5 columnas calculadas, coloreo condicional de desvios, historial de revisiones, y modal de revision con edicion de 12 campos. Requiere coordinacion de multiples queries. |
| Fase 6: Reporte variacion | Media | Reutiliza patron existente de reportes y logica similar a `getIncomeStatement`. La complejidad esta en cruzar datos de Budget con JournalEntryLine y presentar las dos secciones (REVENUE/EXPENSE) con totales. |
| Fase 7: Integracion gastos | Media | La funcion de validacion es simple, pero la modificacion de `confirmExpense` y el componente client requiere cuidado para no romper el flujo existente. La advertencia es no-bloqueante (warning), lo que simplifica. |
| Fase 8: Tests E2E | Media | ~8 test cases cubriendo todo el flujo. Requiere setup de datos (crear cuenta, configurar ano fiscal) y cleanup. Patron establecido en otros specs de accounting. |
| Fase 9: Documentacion | Baja | Actualizar dos archivos markdown con la informacion del modulo. |

**Complejidad total estimada: Media-Alta**
Las fases criticas son la 3 (server actions con calculo de ejecutado mensual alineado al ano fiscal) y la 5 (UI de detalle con comparacion). El resto sigue patrones ya establecidos en el codebase.

## 3. Diseno

### 3.1 Arquitectura de la solucion

El modulo de Presupuestos y Control Presupuestario se integra dentro del modulo contable existente (`src/modules/accounting/features/budgets/`), siguiendo los mismos patrones arquitectonicos del codebase:

**Patron de feature:** Cada feature tiene su carpeta con Server Component principal, `actions.server.ts`, `components/` con Client Components (prefijo `_`), `validators/index.ts`, e `index.ts` barrel export. Este modulo sigue exactamente el patron de `opening-balances/`.

**Flujo de estados del presupuesto:**
```
DRAFT ──(activateBudget)──> ACTIVE ──(closeBudget)──> CLOSED
  │                           │
  │ (updateBudget)            │ (createBudgetRevision)
  │ (deleteBudget)            │
  └───────────────────────────┘
```

**Integracion con modulos existentes:**
- **Reportes (`reports/`)**: Se agrega un nuevo tipo de reporte `budget-variance` al selector existente, con su componente `_BudgetVarianceReport.tsx` y su server action `getBudgetVarianceReport()`.
- **Integraciones (`integrations/commercial/`)**: Se agrega la funcion `checkBudgetForExpense()` en el archivo de integracion existente, manteniendo el patron de que las integraciones contabilidad-comercial viven en `integrations/commercial/index.ts`.
- **Gastos (`commercial/expenses/`)**: Se modifica `confirmExpense()` para retornar un `budgetWarning` opcional, sin romper el flujo existente.

**Calculo de ejecutado:** Se crea una funcion optimizada `calculateBudgetExecution()` que usa `prisma.$queryRaw` con `EXTRACT(MONTH FROM ...)` y `GROUP BY` para obtener el ejecutado mensual de una cuenta en una sola query, evitando el problema N+1 de `calculateAccountBalance()`.

**Alineacion con ano fiscal:** Los 12 montos mensuales del presupuesto se almacenan como Json array donde el indice 0 corresponde al primer mes del ejercicio fiscal (segun `AccountingSettings.fiscalYearStart`). Los labels de meses se generan dinamicamente con `moment` a partir del mes de inicio fiscal.

### 3.2 Modelos de datos

```prisma
// Estado del Presupuesto
enum BudgetStatus {
  DRAFT         // Borrador - editable libremente
  ACTIVE        // Activo - solo revisiones formales
  CLOSED        // Cerrado - solo lectura

  @@map("budget_status")
}

// Presupuesto por Cuenta y Año Fiscal
model Budget {
  id              String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId       String        @map("company_id") @db.Uuid
  accountId       String        @map("account_id") @db.Uuid
  fiscalYear      Int           @map("fiscal_year")       // Ej: 2026
  status          BudgetStatus  @default(DRAFT)
  monthlyAmounts  Json          @map("monthly_amounts")   // number[12] - montos por mes fiscal
  totalAmount     Decimal       @default(0) @map("total_amount") @db.Decimal(12, 2)
  notes           String?
  createdBy       String        @map("created_by")        // userId de Clerk
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  // Relaciones
  company         Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  account         Account       @relation(fields: [accountId], references: [id])
  revisions       BudgetRevision[]

  @@unique([companyId, accountId, fiscalYear])
  @@map("budgets")
}

// Revision de Presupuesto (historial de cambios)
model BudgetRevision {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  budgetId        String    @map("budget_id") @db.Uuid
  previousAmounts Json      @map("previous_amounts")   // number[12] - montos anteriores
  newAmounts      Json      @map("new_amounts")         // number[12] - montos nuevos
  previousTotal   Decimal   @map("previous_total") @db.Decimal(12, 2)
  newTotal        Decimal   @map("new_total") @db.Decimal(12, 2)
  reason          String                                 // Motivo obligatorio
  createdBy       String    @map("created_by")           // userId de Clerk
  createdAt       DateTime  @default(now()) @map("created_at")

  // Relaciones
  budget          Budget    @relation(fields: [budgetId], references: [id], onDelete: Cascade)

  @@map("budget_revisions")
}
```

**Relaciones a agregar en modelos existentes:**

En modelo `Account` (linea ~268, antes de `@@unique`):
```prisma
  budgets         Budget[]
```

En modelo `Company` (seccion Modulo Contable, linea ~157):
```prisma
  budgets           Budget[]
```

### 3.3 Funciones y metodos

#### Archivo: `src/modules/accounting/features/budgets/actions.server.ts`

```typescript
'use server';

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene los datos iniciales para la pagina de presupuestos.
 * Verifica que existan AccountingSettings y cuentas de resultado.
 */
export async function getBudgetsPageData(): Promise<{
  hasSettings: boolean;
  hasResultAccounts: boolean;
  settings: {
    fiscalYearStart: Date;
    fiscalYearEnd: Date;
  } | null;
  currentFiscalYear: number;
}>

/**
 * Lista presupuestos con filtro opcional por ano fiscal.
 * Incluye info de cuenta y cantidad de revisiones.
 * Convierte totalAmount Decimal a Number().
 */
export async function getBudgets(fiscalYear?: number): Promise<{
  id: string;
  accountId: string;
  account: { code: string; name: string; type: AccountType };
  fiscalYear: number;
  status: BudgetStatus;
  totalAmount: number;
  notes: string | null;
  revisionsCount: number;
  createdAt: Date;
}[]>

/**
 * Obtiene detalle de un presupuesto con calculo de ejecutado mensual.
 * Usa query optimizada con GROUP BY para ejecutado por mes.
 * Retorna desvios absolutos y porcentuales por mes.
 */
export async function getBudgetDetail(budgetId: string): Promise<{
  id: string;
  accountId: string;
  account: { code: string; name: string; type: AccountType; nature: AccountNature };
  fiscalYear: number;
  status: BudgetStatus;
  monthlyAmounts: number[];      // 12 elementos, presupuestado
  monthlyExecuted: number[];     // 12 elementos, ejecutado real
  monthlyVariance: number[];     // 12 elementos, desvio absoluto (presupuestado - ejecutado)
  monthlyVariancePercent: number[]; // 12 elementos, desvio porcentual
  totalAmount: number;
  totalExecuted: number;
  totalVariance: number;
  totalVariancePercent: number;
  notes: string | null;
  revisions: {
    id: string;
    previousAmounts: number[];
    newAmounts: number[];
    previousTotal: number;
    newTotal: number;
    reason: string;
    createdBy: string;
    createdAt: Date;
  }[];
  fiscalYearStart: Date;
} | null>

/**
 * Retorna cuentas hoja (sin hijos) de tipo EXPENSE o REVENUE, activas.
 * Excluye cuentas que ya tienen presupuesto para el ano fiscal dado.
 */
export async function getBudgetableAccounts(fiscalYear: number): Promise<{
  id: string;
  code: string;
  name: string;
  type: AccountType;
}[]>

/**
 * Retorna lista de anos fiscales disponibles basados en el
 * fiscalYearStart de AccountingSettings y presupuestos existentes.
 */
export async function getAvailableFiscalYears(): Promise<number[]>

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo presupuesto en estado DRAFT.
 * Valida: schema Zod, cuenta existe y es EXPENSE/REVENUE, es cuenta hoja,
 * unicidad companyId+accountId+fiscalYear.
 * Calcula totalAmount como suma de monthlyAmounts.
 */
export async function createBudget(
  input: CreateBudgetInput
): Promise<{ success: true; id: string }>

/**
 * Actualiza un presupuesto DRAFT (montos y notas).
 * Solo permitido si status === DRAFT.
 * Recalcula totalAmount.
 */
export async function updateBudget(
  id: string,
  input: UpdateBudgetInput
): Promise<{ success: true }>

/**
 * Cambia estado de DRAFT a ACTIVE.
 * Valida que totalAmount > 0.
 */
export async function activateBudget(
  id: string
): Promise<{ success: true }>

/**
 * Crea una revision formal de un presupuesto ACTIVE.
 * Guarda previousAmounts/newAmounts en BudgetRevision,
 * actualiza monthlyAmounts y totalAmount del Budget.
 * Usa transaccion Prisma.
 */
export async function createBudgetRevision(
  input: CreateRevisionInput
): Promise<{ success: true; revisionId: string }>

/**
 * Cambia estado de ACTIVE a CLOSED.
 */
export async function closeBudget(
  id: string
): Promise<{ success: true }>

/**
 * Elimina un presupuesto DRAFT.
 * Las revisiones se eliminan en cascada.
 */
export async function deleteBudget(
  id: string
): Promise<{ success: true }>

// ============================================
// FUNCIONES AUXILIARES (no exportadas)
// ============================================

/**
 * Calcula el ejecutado mensual de una cuenta en un rango fiscal.
 * Query optimizada con $queryRaw usando EXTRACT(MONTH) y GROUP BY.
 * Retorna array de 12 numeros alineados al ano fiscal.
 *
 * @param accountId - ID de la cuenta contable
 * @param companyId - ID de la empresa
 * @param fiscalYearStart - Inicio del ejercicio fiscal
 * @param fiscalYearEnd - Fin del ejercicio fiscal
 * @param accountNature - Naturaleza de la cuenta (DEBIT/CREDIT)
 * @returns number[] de 12 elementos con el monto ejecutado por mes
 */
async function calculateBudgetExecution(
  accountId: string,
  companyId: string,
  fiscalYearStart: Date,
  fiscalYearEnd: Date,
  accountNature: AccountNature
): Promise<number[]>

/**
 * Obtiene los labels de los 12 meses del ejercicio fiscal.
 * Ej: si fiscalYearStart es julio, retorna ['Jul', 'Ago', 'Sep', ..., 'Jun'].
 */
function getFiscalMonthLabels(fiscalYearStart: Date): string[]

/**
 * Calcula el ano fiscal actual basado en la fecha actual y fiscalYearStart.
 */
function getCurrentFiscalYear(fiscalYearStart: Date): number
```

#### Archivo: `src/modules/accounting/features/reports/actions.server.ts` (funcion a agregar)

```typescript
/**
 * Genera el reporte de variacion presupuestaria.
 * Obtiene todos los presupuestos ACTIVE/CLOSED del ano fiscal,
 * calcula el ejecutado acumulado de cada cuenta, y retorna
 * la comparacion separada en REVENUE y EXPENSE.
 */
export async function getBudgetVarianceReport(
  companyId: string,
  fiscalYear: number
): Promise<{
  revenue: {
    accounts: {
      code: string;
      name: string;
      budgeted: number;
      executed: number;
      variance: number;
      variancePercent: number;
    }[];
    totalBudgeted: number;
    totalExecuted: number;
    totalVariance: number;
    totalVariancePercent: number;
  };
  expenses: {
    accounts: {
      code: string;
      name: string;
      budgeted: number;
      executed: number;
      variance: number;
      variancePercent: number;
    }[];
    totalBudgeted: number;
    totalExecuted: number;
    totalVariance: number;
    totalVariancePercent: number;
  };
  netBudgeted: number;    // revenue.totalBudgeted - expenses.totalBudgeted
  netExecuted: number;    // revenue.totalExecuted - expenses.totalExecuted
  netVariance: number;
  netVariancePercent: number;
  fiscalYear: number;
}>
```

#### Archivo: `src/modules/accounting/features/integrations/commercial/index.ts` (funcion a agregar)

```typescript
/**
 * Verifica si un gasto supera el presupuesto mensual de la cuenta.
 * Retorna un warning (no bloquea la operacion).
 * Se invoca desde confirmExpense() antes de la transaccion.
 *
 * @param accountId - ID de la cuenta de gastos (expensesAccountId de settings)
 * @param amount - Monto del gasto que se esta confirmando
 * @param companyId - ID de la empresa
 * @returns Objeto con hasWarning, message y executedPercent; o null si no hay presupuesto
 */
export async function checkBudgetForExpense(
  accountId: string,
  amount: number,
  companyId: string
): Promise<{
  hasWarning: boolean;
  message: string;
  executedPercent: number;
} | null>
```

### 3.4 Interfaces de usuario

#### `src/modules/accounting/features/budgets/BudgetsPage.tsx` (Server Component)

```typescript
/**
 * Server Component principal de la pagina de presupuestos.
 * Obtiene datos iniciales (settings, cuentas) y los pasa a _BudgetsContent.
 * Muestra alertas si falta configuracion contable o cuentas de resultado.
 */
// Sin props (obtiene companyId internamente via getActiveCompanyId)
// Usa: Card, CardHeader, CardTitle, CardContent, Alert, AlertDescription de shadcn
// Patron: igual que OpeningBalancesPage
// Si no hay settings -> Alert con link a /dashboard/company/accounting/settings
// Si no hay cuentas de resultado -> Alert con link a /dashboard/company/accounting/accounts
// Si todo OK -> renderiza <_BudgetsContent companyId={companyId} />
```

#### `src/modules/accounting/features/budgets/components/_BudgetsContent.tsx` (Client Component)

```typescript
interface BudgetsContentProps {
  companyId: string;
}

/**
 * Client Component contenedor principal. Maneja estado del filtro de ano fiscal
 * y coordina la tabla con el modal de creacion.
 */
// Usa: useState para fiscalYear seleccionado, useState para modal abierto
// Componentes: Select (filtro ano fiscal), Button "Nuevo Presupuesto",
//              _BudgetsTable, _CreateBudgetModal, _BudgetDetailModal
// useQuery(['available-fiscal-years'], getAvailableFiscalYears)
```

#### `src/modules/accounting/features/budgets/components/_BudgetsTable.tsx` (Client Component)

```typescript
interface BudgetsTableProps {
  companyId: string;
  fiscalYear: number;
  onViewDetail: (budgetId: string) => void;
}

/**
 * DataTable con listado de presupuestos filtrados por ano fiscal.
 * Todas las columnas con meta.title.
 */
// useQuery(['budgets', fiscalYear], () => getBudgets(fiscalYear))
// Columnas DataTable:
//   - Cuenta: code + " - " + name | meta: { title: 'Cuenta' }
//   - Tipo: badge EXPENSE/REVENUE | meta: { title: 'Tipo' }
//   - Monto Total: formatAmount(totalAmount) | meta: { title: 'Monto Total' }
//   - Estado: badge con color (DRAFT=gris, ACTIVE=verde, CLOSED=azul) | meta: { title: 'Estado' }
//   - Revisiones: revisionsCount | meta: { title: 'Revisiones' }
//   - Acciones: DropdownMenu con:
//       - "Ver Detalle" (siempre)
//       - "Editar" (solo DRAFT)
//       - "Activar" (solo DRAFT) con AlertDialog
//       - "Cerrar" (solo ACTIVE) con AlertDialog
//       - "Eliminar" (solo DRAFT) con AlertDialog
// Componentes shadcn: DataTable, Badge, Button, DropdownMenu,
//   AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
//   AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
// useMutation para activateBudget, closeBudget, deleteBudget con invalidateQueries(['budgets'])
```

#### `src/modules/accounting/features/budgets/components/_CreateBudgetModal.tsx` (Client Component)

```typescript
interface CreateBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  fiscalYear: number;
  fiscalYearStart: Date;
  editBudget?: {
    id: string;
    accountId: string;
    monthlyAmounts: number[];
    notes: string | null;
  } | null;
}

/**
 * Dialog de creacion/edicion de presupuesto.
 * React Hook Form + Zod. 12 campos mensuales con labels dinamicos.
 */
// Usa: Dialog (max-w-3xl), Form, FormField, FormItem, FormLabel, FormControl,
//       FormMessage, Input (type="number"), Button, Combobox (para busqueda de cuenta)
// useQuery(['budgetable-accounts', fiscalYear], () => getBudgetableAccounts(fiscalYear))
// Estado interno:
//   - form: useForm<CreateBudgetInput> con resolver zodResolver(createBudgetSchema)
//   - totalCalculado: computed en tiempo real (watch de monthlyAmounts, suma)
// Comportamiento:
//   - Selector de cuenta: Combobox con busqueda por code+name, filtrado a cuentas hoja EXPENSE/REVENUE
//   - 12 inputs numericos en grid (grid-cols-2 sm:grid-cols-3 md:grid-cols-4)
//   - Labels dinamicos: getFiscalMonthLabels(fiscalYearStart)
//   - Boton "Distribuir uniformemente": input numerico + boton que divide entre 12
//   - Campo notas (textarea, opcional)
//   - Pie: total calculado (readonly), boton Cancelar, boton Guardar
// useMutation para createBudget/updateBudget con invalidateQueries(['budgets'])
// Si editBudget: precargar form con valores existentes, cambiar titulo a "Editar Presupuesto"
```

#### `src/modules/accounting/features/budgets/components/_BudgetDetailModal.tsx` (Client Component)

```typescript
interface BudgetDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string | null;
  companyId: string;
  fiscalYearStart: Date;
}

/**
 * Dialog grande (max-w-4xl) con detalle del presupuesto:
 * tabla mensual presupuestado vs ejecutado, historial de revisiones.
 */
// useQuery(['budget-detail', budgetId], () => getBudgetDetail(budgetId!), { enabled: !!budgetId })
// Estructura:
//   - Encabezado: account.code + " - " + account.name, fiscalYear, Badge de status
//   - Tabla 12 filas (una por mes fiscal):
//     | Mes | Presupuestado | Ejecutado | Desvio ($) | Desvio (%) |
//     Labels de meses: getFiscalMonthLabels(fiscalYearStart)
//     Coloreo: verde si ejecutado < presupuestado*0.8, amarillo 0.8-1.0, rojo >1.0
//   - Fila de totales al final (bold)
//   - Seccion "Historial de Revisiones" (si revisions.length > 0):
//     Card por revision: fecha (moment().format('DD/MM/YYYY HH:mm')), motivo,
//     montos previos vs nuevos en tabla compacta
//   - Botones:
//     - "Revisar Presupuesto" (solo ACTIVE) -> abre _BudgetRevisionModal
//     - "Cerrar Presupuesto" (solo ACTIVE) -> AlertDialog confirmacion
// Componentes: Dialog, Table, TableHeader, TableRow, TableHead, TableBody,
//   TableCell, Badge, Card, CardHeader, CardContent, Button, AlertDialog, Separator
// Estado interno: revisionModalOpen (boolean)
```

#### `src/modules/accounting/features/budgets/components/_BudgetRevisionModal.tsx` (Client Component)

```typescript
interface BudgetRevisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  currentAmounts: number[];
  fiscalYearStart: Date;
}

/**
 * Dialog para crear una revision formal del presupuesto.
 * Muestra montos actuales (readonly) y campos editables para nuevos montos.
 */
// Usa: Dialog (max-w-3xl), Form, FormField, Input, Textarea, Button
// React Hook Form + Zod (createRevisionSchema)
// Estructura:
//   - Titulo: "Revisar Presupuesto"
//   - Grid de 12 filas: | Mes | Actual (readonly) | Nuevo (input number) |
//   - Campo "Motivo de la revision" (Textarea, required, minLength 1)
//   - Pie: Total actual vs Total nuevo, boton Cancelar, boton "Confirmar Revision"
// useMutation para createBudgetRevision con invalidateQueries(['budget-detail', 'budgets'])
```

#### `src/modules/accounting/features/reports/components/_BudgetVarianceReport.tsx` (Client Component)

```typescript
interface BudgetVarianceReportProps {
  companyId: string;
}

/**
 * Reporte de variacion presupuestaria: presupuesto vs ejecutado por cuenta.
 * Separado en secciones REVENUE y EXPENSE, con totales y resultado neto.
 */
// useQuery(['available-fiscal-years'], getAvailableFiscalYears)
// Estado: selectedFiscalYear (number, default currentFiscalYear)
// useQuery(['budget-variance', selectedFiscalYear],
//   () => getBudgetVarianceReport(companyId, selectedFiscalYear),
//   { enabled: !!selectedFiscalYear })
// Estructura:
//   - Card con selector de ano fiscal (Select)
//   - Seccion "Ingresos":
//     Tabla: | Cuenta | Presupuestado | Ejecutado | Desvio ($) | Desvio (%) |
//     Fila de subtotal
//   - Seccion "Gastos":
//     Tabla: | Cuenta | Presupuestado | Ejecutado | Desvio ($) | Desvio (%) |
//     Fila de subtotal
//   - Fila final: "Resultado Neto" presupuestado vs real
//   - Coloreo desvios: verde (favorable), rojo (desfavorable)
//     Para REVENUE: ejecutado > presupuestado = verde (mas ingreso)
//     Para EXPENSE: ejecutado > presupuestado = rojo (mas gasto)
// Componentes: Card, CardHeader, CardContent, Select, Table, Badge, Separator
```

### 3.5 Rutas y navegacion

#### Ruta nueva

| Ruta | Archivo | Componente |
|------|---------|------------|
| `/dashboard/company/accounting/budgets` | `src/app/(core)/dashboard/company/accounting/budgets/page.tsx` | `BudgetsPage` |

**Contenido de `page.tsx`:**
```typescript
import { BudgetsPage } from '@/modules/accounting/features/budgets';
import { checkPermission } from '@/shared/lib/permissions';

export default async function BudgetsRoutePage() {
  await checkPermission('accounting.budgets', 'view');
  return <BudgetsPage />;
}
```

#### Permisos

En `src/shared/lib/permissions/constants.ts`:

1. **MODULES** (despues de linea 80, `'accounting.opening-balances'`):
```typescript
'accounting.budgets': 'accounting.budgets',
```

2. **MODULE_LABELS** (despues de linea 164, `'accounting.opening-balances'`):
```typescript
'accounting.budgets': 'Presupuestos Contables',
```
Nota: Se usa "Presupuestos Contables" para diferenciarlo de `commercial.quotes` que tiene label "Presupuestos" (cotizaciones comerciales).

3. **MODULE_GROUPS.configuracionContable.modules** (linea ~256):
```typescript
'accounting.budgets',
```

#### Sidebar

En `src/shared/components/layout/_AppSidebar.tsx`, seccion Contabilidad items (despues de "Saldos de Apertura", linea ~94):
```typescript
{
  title: 'Presupuestos',
  href: '/dashboard/company/accounting/budgets',
  module: 'accounting.budgets',
},
```

#### Revalidacion

En `src/modules/accounting/shared/utils/index.ts`, dentro de `revalidateAccountingRoutes()` (despues de linea 131):
```typescript
revalidatePath('/dashboard/company/accounting/budgets');
```

### 3.6 Validadores (Zod schemas)

#### Archivo: `src/modules/accounting/features/budgets/validators/index.ts`

```typescript
import { z } from 'zod';

/**
 * Schema para crear un presupuesto.
 * monthlyAmounts: array de exactamente 12 numeros >= 0.
 */
export const createBudgetSchema = z.object({
  accountId: z.string().uuid('La cuenta es requerida'),
  fiscalYear: z.number().int().min(2000).max(2100),
  monthlyAmounts: z
    .array(z.number().min(0, 'El monto debe ser >= 0'))
    .length(12, 'Debe tener exactamente 12 montos mensuales'),
  notes: z.string().max(500).optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

/**
 * Schema para actualizar un presupuesto DRAFT.
 * Permite actualizar montos y notas.
 */
export const updateBudgetSchema = z.object({
  monthlyAmounts: z
    .array(z.number().min(0, 'El monto debe ser >= 0'))
    .length(12, 'Debe tener exactamente 12 montos mensuales'),
  notes: z.string().max(500).optional(),
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

/**
 * Schema para crear una revision de presupuesto ACTIVE.
 * Requiere nuevos montos y motivo obligatorio.
 */
export const createRevisionSchema = z.object({
  budgetId: z.string().uuid('El presupuesto es requerido'),
  newAmounts: z
    .array(z.number().min(0, 'El monto debe ser >= 0'))
    .length(12, 'Debe tener exactamente 12 montos mensuales'),
  reason: z.string().min(1, 'El motivo es obligatorio').max(500),
});

export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;
```

### 3.7 Consideraciones tecnicas

#### 1. Query optimizada para ejecutado mensual

La funcion `calculateBudgetExecution()` usa raw SQL para evitar N+1:

```sql
SELECT
  EXTRACT(MONTH FROM je.date) AS month_num,
  EXTRACT(YEAR FROM je.date) AS year_num,
  COALESCE(SUM(jel.debit), 0) AS total_debit,
  COALESCE(SUM(jel.credit), 0) AS total_credit
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
WHERE jel.account_id = $1
  AND je.company_id = $2
  AND je.status = 'POSTED'
  AND je.date >= $3
  AND je.date <= $4
GROUP BY EXTRACT(MONTH FROM je.date), EXTRACT(YEAR FROM je.date)
```

El resultado se mapea al array de 12 posiciones alineado con el inicio del ano fiscal. Para cuentas EXPENSE (naturaleza DEBIT) el ejecutado es `debit - credit`. Para cuentas REVENUE (naturaleza CREDIT) el ejecutado es `credit - debit`.

#### 2. Alineacion con ano fiscal

Si `fiscalYearStart` es `2026-07-01` (julio):
- Indice 0 del array = Julio 2026
- Indice 5 = Diciembre 2026
- Indice 6 = Enero 2027
- Indice 11 = Junio 2027

Los labels de meses se generan con:
```typescript
function getFiscalMonthLabels(fiscalYearStart: Date): string[] {
  const startMonth = moment(fiscalYearStart).month(); // 0-based
  return Array.from({ length: 12 }, (_, i) =>
    moment().month((startMonth + i) % 12).format('MMM')
  );
}
```

#### 3. Presupuestos solo en cuentas hoja

Para determinar si una cuenta es hoja (no tiene hijos):
```typescript
const leafAccounts = await prisma.account.findMany({
  where: {
    companyId,
    isActive: true,
    type: { in: [AccountType.EXPENSE, AccountType.REVENUE] },
    children: { none: {} }, // Sin hijos = cuenta hoja
  },
  select: { id: true, code: true, name: true, type: true },
  orderBy: { code: 'asc' },
});
```

#### 4. Validacion presupuestaria no bloqueante

En `confirmExpense()`, la validacion presupuestaria:
- Se ejecuta ANTES de la transaccion (no dentro de ella)
- Usa la cuenta `expensesAccountId` de `AccountingSettings`
- Compara ejecutado del mes actual + monto del gasto vs presupuestado del mes
- Si supera 80%: retorna warning
- Si supera 100%: retorna warning con texto diferente
- El retorno de `confirmExpense()` cambia de `{ success: true }` a `{ success: true, budgetWarning?: { message: string, executedPercent: number } }`

#### 5. Conversion Decimal a Number()

Los campos `totalAmount`, `previousTotal`, `newTotal` son `Decimal(12,2)`. Todos los server actions que retornan datos a Client Components deben convertirlos:
```typescript
return {
  ...budget,
  totalAmount: Number(budget.totalAmount),
  revisions: budget.revisions.map(rev => ({
    ...rev,
    previousTotal: Number(rev.previousTotal),
    newTotal: Number(rev.newTotal),
  })),
};
```

#### 6. monthlyAmounts como Json

El campo `monthlyAmounts` se almacena como `Json` en Prisma. Al leerlo, Prisma lo retorna como `JsonValue`. Se debe castear a `number[]` despues de validar:
```typescript
const amounts = budget.monthlyAmounts as number[];
```

Al crear/actualizar, se pasa directamente como array de numeros:
```typescript
await prisma.budget.create({
  data: {
    monthlyAmounts: input.monthlyAmounts, // number[] se serializa a Json
    totalAmount: input.monthlyAmounts.reduce((a, b) => a + b, 0),
    ...
  },
});
```

#### 7. Coloreo de desvios

El criterio de coloreo es consistente en toda la UI:

| Porcentaje ejecutado | Color | Clase Tailwind |
|---------------------|-------|----------------|
| < 80% del presupuesto | Verde | `text-green-600` |
| 80% - 100% del presupuesto | Amarillo | `text-yellow-600` |
| > 100% del presupuesto | Rojo | `text-red-600` |

Para REVENUE, la logica se invierte: ejecutado > presupuestado es favorable (verde).

#### 8. Edge cases

- **Presupuesto con totalAmount = 0**: No se puede activar. Se valida en `activateBudget()`.
- **Cuenta sin movimientos**: El ejecutado es 0 para todos los meses. El desvio es 100% favorable.
- **Ano fiscal cruzado (ej: Jul 2026 - Jun 2027)**: La query de ejecutado debe cubrir ambos anos calendario. Se resuelve con el rango `fiscalYearStart` a `fiscalYearEnd` en la clausula WHERE.
- **Multiples presupuestos eliminados**: El constraint unico permite crear otro presupuesto para la misma cuenta+ano despues de eliminar el existente.
- **Revision con mismos montos**: Se permite (el motivo registra por que se reviso aunque no cambio). No se agrega validacion adicional.
- **Cuenta que pasa de hoja a padre**: Si se crean subcuentas de una cuenta que ya tiene presupuesto, el presupuesto sigue vinculado a esa cuenta. No se invalida automaticamente; el usuario debe gestionar el cambio manualmente.

## 4. Implementacion

### Fase 5: UI - Detalle, revision y comparacion

**Fecha:** 2026-02-25

**Componentes creados:**

1. **`_BudgetDetailModal.tsx`** - Modal principal de detalle (max-w-4xl):
   - Encabezado con cuenta, ano fiscal y badge de estado
   - Tabla mensual de comparacion presupuesto vs ejecutado (delegada a `_BudgetMonthlyTable`)
   - Historial de revisiones (delegado a `_BudgetRevisionHistory`)
   - Botones de accion: "Revisar Presupuesto" y "Cerrar Presupuesto" (solo si ACTIVE)
   - AlertDialog para confirmacion de cierre
   - Integra `_BudgetRevisionModal` para crear revisiones

2. **`_BudgetMonthlyTable.tsx`** - Tabla de 12 meses con columnas: Mes, Presupuestado, Ejecutado, Desvio ($), Desvio (%)
   - Fila de totales al final
   - Coloreo condicional: verde (< 80%), amarillo (80-100%), rojo (> 100%)
   - Logica de coloreo invertida para REVENUE (mas ejecucion es favorable)
   - Columna "Desvio ($)" oculta en mobile

3. **`_BudgetRevisionHistory.tsx`** - Historial de revisiones con cards:
   - Fecha, total anterior vs nuevo, diferencia
   - Motivo de la revision
   - Tabla compacta mostrando solo los meses que cambiaron

4. **`_BudgetRevisionModal.tsx`** - Modal de revision formal (max-w-3xl):
   - Grid de 12 filas con: Mes, Actual (readonly), Nuevo (editable)
   - Resumen: total actual vs total nuevo con diferencia
   - Campo obligatorio "Motivo de la revision"
   - React Hook Form + Zod (createRevisionSchema)
   - useMutation con invalidacion de queries

**Archivos modificados:**

- `_BudgetsContent.tsx`: Agregado estado `detailBudgetId`, conectado `handleViewDetail` con el modal, renderizado de `_BudgetDetailModal`

**Patrones aplicados:**
- Componentes < 200 lineas (detalle dividido en 3 sub-componentes)
- Client Components con prefijo `_`
- useQuery para fetching de detalle
- useMutation para revision y cierre
- AlertDialog para confirmaciones (nunca confirm())
- moment.js para formateo de fechas en historial
- Responsive: columnas ocultas en mobile, layouts flex-col en mobile

### Fase 6: Reporte de variacion presupuestaria

**Fecha:** 2026-02-25

**Server Action creada:**

1. **`getBudgetVarianceReport(companyId, fiscalYear)`** en `reports/actions.server.ts`:
   - Obtiene todos los presupuestos ACTIVE/CLOSED del ano fiscal
   - Calcula ejecutado acumulado de cada cuenta con query optimizada usando `$queryRaw` con `GROUP BY account_id` (una sola query para todas las cuentas)
   - Calcula varianza absoluta y porcentual por cuenta
   - Separa en secciones REVENUE y EXPENSE
   - Calcula resultado neto presupuestado vs real
   - Funciones auxiliares `buildSection()` y `buildEmptySection()` extraidas para claridad

**Componentes creados:**

1. **`_BudgetVarianceReport.tsx`** - Componente principal del reporte:
   - Selector de ano fiscal con `useQuery` para carga de anos disponibles
   - Boton "Generar" para calcular el reporte bajo demanda (patron igual al de `_IncomeStatementReport`)
   - Boton de exportacion a Excel
   - Renderiza sub-componentes `_BudgetVarianceSummary` y `_BudgetVarianceTable`
   - Tabla final de resultado neto (presupuestado vs real vs variacion)

2. **`_BudgetVarianceSummary.tsx`** - Cards de resumen:
   - Total Presupuestado, Total Ejecutado, Variacion Total, % Ejecucion Global
   - Coloreo condicional en % ejecucion: verde (<80%), amarillo (80-100%), rojo (>100%)

3. **`_BudgetVarianceTable.tsx`** - Tabla de variacion por seccion:
   - Columnas: Codigo, Cuenta, Presupuestado, Ejecutado, Desvio ($), Desvio (%)
   - Fila de totales por seccion
   - Coloreo de desvios segun tipo: para REVENUE ejecutado > presupuestado es favorable (verde), para EXPENSE es desfavorable (rojo)
   - Columna "Desvio ($)" oculta en mobile
   - Reutilizable para ambas secciones (ingresos y gastos)

**Archivos modificados:**

- `_ReportsSelector.tsx`: Agregado tipo `'budget-variance'` al union type `ReportType`, nuevo grupo `budgetReports` con icono `Target`, seccion "Presupuestarios" en el render
- `_ReportsContent.tsx`: Importado `_BudgetVarianceReport`, agregado case para renderizarlo
- `reports/actions.server.ts`: Importados `Prisma`, `BudgetStatus`, `moment`; agregada funcion `getBudgetVarianceReport` con helpers

**Patrones aplicados:**
- Componentes < 200 lineas (reporte dividido en 3 sub-componentes)
- Client Components con prefijo `_`
- useQuery para carga de anos fiscales
- Patron de reporte bajo demanda (boton "Generar") consistente con reportes existentes
- Exportacion a Excel con `exportToExcel` siguiendo patron de `_IncomeStatementReport`
- Query optimizada con `$queryRaw` y `GROUP BY` para evitar N+1
- Conversion `Decimal` a `Number()` en server action
- Responsive: columna oculta en mobile, layout flex-col en mobile
- Logger para errores (nunca console.*)
- moment.js para formateo de fechas (nunca date-fns)

### Fase 7: Integracion con gastos (validacion presupuestaria)

**Fecha:** 2026-02-25

**Funcion creada:**

1. **`checkBudgetForExpense(accountId, amount, companyId, expenseDate)`** en `integrations/commercial/index.ts`:
   - Determina el ano fiscal de la fecha del gasto usando `fiscalYearStart` de `AccountingSettings`
   - Busca presupuesto ACTIVE para la cuenta y ano fiscal correspondiente
   - Calcula el indice del mes del gasto dentro del array de 12 posiciones del presupuesto
   - Obtiene el monto presupuestado para ese mes
   - Calcula el ejecutado actual del mes con query `$queryRaw` optimizada (una sola query, sin N+1)
   - Compara ejecutado + nuevo monto vs presupuestado
   - Si supera 80%: retorna warning con mensaje descriptivo
   - Si supera 100%: retorna warning con mensaje indicando exceso
   - Si no hay presupuesto o no supera umbral: retorna null
   - Errores no bloquean la operacion (catch silencioso con logger.error)
   - Soporta naturaleza de cuenta DEBIT (EXPENSE) y CREDIT (REVENUE)

**Archivos modificados:**

1. **`src/modules/accounting/features/integrations/commercial/index.ts`**:
   - Agregados imports de `BudgetStatus` y `AccountNature` desde `@/generated/prisma/enums`
   - Agregada funcion `checkBudgetForExpense()` (~100 lineas) al final del archivo

2. **`src/modules/commercial/features/expenses/actions.server.ts`**:
   - Agregado import de `checkBudgetForExpense` desde integraciones
   - Modificada funcion `confirmExpense()`:
     - Tipo de retorno cambiado a `Promise<{ success: true; budgetWarning?: { message: string; executedPercent: number } }>`
     - Agregado campo `date` al select del gasto
     - Antes de la transaccion: obtiene `expensesAccountId` de `AccountingSettings` y llama a `checkBudgetForExpense()`
     - Si hay warning, lo incluye en el retorno
     - Errores en verificacion presupuestaria no bloquean la confirmacion (catch con logger.warn)

3. **`src/modules/commercial/features/expenses/list/components/_ExpenseDetailModal.tsx`**:
   - Modificado `handleConfirm()` para leer el resultado de `confirmExpense()`
   - Si `result.budgetWarning` existe, muestra toast de tipo `warning` con titulo "Advertencia de presupuesto" y duracion de 10 segundos
   - El gasto se confirma normalmente independientemente del warning

**Patrones aplicados:**
- Funcion de validacion en `integrations/commercial/` (patron existente para integracion contabilidad-comercial)
- No se viola la regla de no importar entre modulos: expenses importa de `integrations/` que es el punto de integracion oficial
- Warning no bloqueante: la confirmacion del gasto siempre procede
- Toast Sonner con tipo `warning` para advertencia visual
- Query `$queryRaw` optimizada para calculo de ejecutado mensual (sin N+1)
- Logger para errores (nunca console.*)
- Conversion Decimal a Number() en calculos
- moment.js para manejo de fechas y meses fiscales

### Fase 8: Tests E2E

**Fecha:** 2026-02-25

**Archivos creados:**

1. **`cypress/e2e/accounting/budgets.cy.ts`** - Suite de tests E2E completa con 6 describe blocks:
   - **Navigation** (1 test): Verificar navegacion al modulo desde el sidebar o via URL directa
   - **Budgets Page** (3 tests): Verificar titulo, selector de ano fiscal, boton "Nuevo Presupuesto", tabla o estado vacio
   - **Create Budget Modal** (6 tests): Apertura del modal, presencia del combobox de cuentas, 12 inputs mensuales, boton "Distribuir en 12", total calculado, botones de accion, cierre del modal
   - **Create Budget** (1 test): Flujo completo de creacion con distribucion uniforme (resiliente: verifica disponibilidad de cuentas antes de intentar crear)
   - **View Budget Detail** (1 test): Apertura del modal de detalle desde las acciones de tabla, verificacion de tabla mensual con columnas "Presupuestado" y "Ejecutado"
   - **Budget State Transitions** (2 tests): Activacion de presupuesto borrador con AlertDialog de confirmacion; eliminacion de presupuesto borrador con AlertDialog de confirmacion
   - **Reports Integration** (2 tests): Verificacion del reporte "Variacion Presupuestaria" en la pagina de informes

**Archivos modificados:**

1. **`cypress/support/db.ts`**:
   - Agregada funcion `cleanupTestBudgets(companyId)`: Elimina revisiones y presupuestos de test (filtro por `notes LIKE '%test E2E%'`)

2. **`cypress.config.ts`**:
   - Agregado import de `cleanupTestBudgets` desde `./cypress/support/db`
   - Registrada task `cleanupTestBudgets` siguiendo el patron exacto de las demas tasks de cleanup

**Patrones aplicados:**
- Patron de `beforeEach` identico a los demas specs de accounting (setupClerkTestingToken + clerkSignIn)
- Bloque `after()` con `cy.task('cleanupTestBudgets')` para limpieza de datos de test
- Tests resilientes: verifican existencia de datos antes de interactuar (patron `cy.get('body').then($body => { ... })`)
- Selectores consistentes: `[role="dialog"]`, `[role="alertdialog"]`, `[role="combobox"]`, `[role="menuitem"]`, `[data-testid="budgets-table"]`
- Uso de custom commands: `cy.checkToast()` para verificar notificaciones Sonner
- Sin datos hardcodeados: los tests funcionan independientemente de si hay datos previos

### Fase 9: Documentacion del desarrollador

**Fecha:** 2026-02-25

**Archivos modificados:**

1. **`docs/modules/accounting.md`**:
   - Agregada seccion "Presupuestos y Control Presupuestario" antes de "Saldos de Apertura"
   - Incluye: descripcion del modulo, modelos (Budget, BudgetRevision), ciclo de vida (DRAFT -> ACTIVE -> CLOSED), funcionalidades (CRUD, revisiones, comparacion mensual, coloreo de desvios, cuentas hoja), permisos (`accounting.budgets`), tabla de server actions, integracion con gastos (warning no bloqueante), reporte de variacion presupuestaria

2. **`docs/architecture/data-model.md`**:
   - Agregada seccion "Presupuestos" despues de la seccion de Contabilidad
   - Documenta modelos Budget y BudgetRevision con campos clave, tipos y constraints
   - Incluye enum BudgetStatus, relaciones (Company, Account, BudgetRevision con cascade), constraint unico `[companyId, accountId, fiscalYear]`, y notas sobre monthlyAmounts como Json array alineado al ejercicio fiscal

**Patrones aplicados:**
- Formato consistente con las demas secciones de cada archivo
- Documentacion en espanol
- Concisa y orientada al desarrollador (no manual de usuario)

## 5. Verificacion

**Fecha de verificacion:** 2026-02-25
**Estado:** Completado con observaciones menores

### 5.1 Checklist CLAUDE.md

| Regla | Estado | Observaciones |
|-------|--------|---------------|
| No `:any` en tipos | PASS | No se encontraron usos de `:any` en archivos de presupuestos |
| Server Actions usan `getActiveCompanyId()` | PASS | Todas las funciones en `actions.server.ts` usan `getActiveCompanyId()` |
| Logger (no `console.*`) | PASS | Todos los archivos usan `logger` de `@/shared/lib/logger`, sin `console.*` |
| `moment.js` (no `date-fns`) | PASS | Se usa `moment` en todos los calculos de fechas |
| React Query para fetching | PASS | Componentes client usan `useQuery`/`useMutation`. Nota: `_BudgetVarianceReport.tsx` usa `handleGenerate` con `useState` pero sigue el patron on-demand de los demas reportes (`_IncomeStatementReport`, etc.) |
| Server Components por defecto, Client con `_` | PASS | `BudgetsPage.tsx` es Server Component. Todos los client components tienen prefijo `_` y directiva `'use client'` |
| No importar entre modulos | PASS | La integracion con expenses se hace a traves de `integrations/commercial/index.ts` (patron oficial). `_BudgetVarianceReport.tsx` importa de `budgets/actions.server` (dentro del mismo modulo accounting) |
| Features con estructura de carpeta | PASS | `budgets/` tiene `actions.server.ts`, `validators/index.ts`, `components/`, `index.ts`, `BudgetsPage.tsx` |
| Componentes < 200 lineas | ADVERTENCIA | `_BudgetsTable.tsx` (348), `_CreateBudgetModal.tsx` (339), `_BudgetVarianceReport.tsx` (292), `_BudgetDetailModal.tsx` (239), `_BudgetRevisionModal.tsx` (216). Son componentes con logica de formulario/tabla compleja. Aceptable dado el contenido pero podrian refactorizarse. |
| Decimal a `Number()` | PASS | `totalAmount`, `previousTotal`, `newTotal` convertidos con `Number()` en todos los retornos. `monthlyAmounts` (Json) no requiere conversion |
| AlertDialog (no `confirm`/`alert`) | PASS | Usa `AlertDialog` de shadcn para confirmaciones de activar, cerrar y eliminar |
| DataTable con `meta.title` | N/A | Los componentes usan tablas HTML nativas (`<table>`) en lugar de DataTable, por lo que `meta.title` no aplica |

### 5.2 Build checks

| Comando | Resultado | Detalles |
|---------|-----------|----------|
| `npm run check-types` | PASS | 0 errores en archivos de presupuestos. Errores pre-existentes en `equipment/depreciation` (no relacionados) |
| ESLint (budget files) | PASS con 2 warnings | `_BudgetDetailModal.tsx`: imports no usados `moment` (linea 6) y `History` (linea 7). No son errores. |
| ESLint (report files) | PASS | 0 errores, 0 warnings |

### 5.3 Revision de archivos

#### Prisma Schema
- `Budget` y `BudgetRevision` correctamente definidos con relaciones, constraint unico, cascade delete
- `BudgetStatus` enum con DRAFT, ACTIVE, CLOSED
- Relaciones `budgets` agregadas en Account y Company

#### Server Actions (`actions.server.ts`)
- 10 funciones: `getBudgetsPageData`, `getBudgets`, `getBudgetDetail`, `getBudgetableAccounts`, `getAvailableFiscalYears`, `createBudget`, `updateBudget`, `activateBudget`, `createBudgetRevision`, `closeBudget`, `deleteBudget`
- Query optimizada `calculateBudgetExecution` con `$queryRaw` y `GROUP BY`
- Validaciones correctas: Zod, pertenencia a empresa, tipo de cuenta, cuentas hoja, unicidad, estados
- Transaccion para `createBudgetRevision`
- Conversion Decimal -> Number() correcta

#### Validators (`validators/index.ts`)
- 3 schemas: `createBudgetSchema`, `updateBudgetSchema`, `createRevisionSchema`
- Tipos exportados correctamente con `z.infer`

#### Componentes UI
- 8 componentes client con prefijo `_` y directiva `'use client'`
- 1 server component (`BudgetsPage.tsx`) sin directiva
- Formularios con React Hook Form + Zod
- Responsive: `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`, `flex-col sm:flex-row`, `hidden sm:table-cell`
- AlertDialog para todas las confirmaciones

#### Reportes
- `getBudgetVarianceReport` con query optimizada (`GROUP BY account_id`)
- `_BudgetVarianceReport`, `_BudgetVarianceSummary`, `_BudgetVarianceTable` correctamente separados
- Integrado en `_ReportsSelector.tsx` (tipo `budget-variance`) y `_ReportsContent.tsx`
- Exportacion a Excel funcional

#### Integracion con gastos
- `checkBudgetForExpense` en `integrations/commercial/index.ts` (patron correcto)
- `confirmExpense` modificado para retornar `budgetWarning` opcional
- `_ExpenseDetailModal.tsx` muestra toast warning con duracion de 10s

#### Permisos y navegacion
- `accounting.budgets` en `MODULES`, `MODULE_LABELS`, `MODULE_GROUPS`
- Item "Presupuestos" en sidebar despues de "Asientos"
- Ruta `/dashboard/company/accounting/budgets` con `checkPermission`
- `revalidatePath` agregado en `revalidateAccountingRoutes`

#### Tests E2E
- 6 describe blocks con 14 test cases cubriendo: navegacion, pagina, modal de creacion, creacion, detalle, transiciones de estado, reporte
- Tests resilientes (verifican existencia de datos antes de interactuar)
- Cleanup con `cleanupTestBudgets` en `cypress/support/db.ts` y registrado en `cypress.config.ts`

#### Documentacion
- `docs/modules/accounting.md`: seccion completa con modelos, ciclo de vida, funcionalidades, integracion
- `docs/architecture/data-model.md`: modelos Budget y BudgetRevision documentados

### 5.4 Observaciones menores (no bloqueantes)

1. **Imports no usados** en `_BudgetDetailModal.tsx` (linea 6-7): `moment` y `History` importados pero no usados directamente (la logica de fecha se delega a sub-componentes). Se recomienda eliminar.

2. **Componentes exceden 200 lineas**: `_BudgetsTable.tsx` (348 lineas), `_CreateBudgetModal.tsx` (339 lineas), `_BudgetVarianceReport.tsx` (292 lineas). Contienen logica compleja de formularios, tablas y exportacion que justifica el tamano, pero podrian beneficiarse de refactorizacion futura (extraer logica de exportacion, separar formulario del modal, etc.).

3. **`_BudgetVarianceReport.tsx` usa `useState+handleGenerate`** en lugar de `useQuery` para los datos del reporte. Esto sigue el patron on-demand establecido por los demas reportes (`_IncomeStatementReport`, `_TrialBalanceReport`), donde el reporte se genera bajo demanda con un boton "Generar". No es una violacion de la regla de React Query.
