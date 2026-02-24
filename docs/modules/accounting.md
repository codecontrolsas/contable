# Modulo Contabilidad

**Rutas:** `/dashboard/company/accounting/*`
**Archivos:** `src/modules/accounting/`

---

## Plan de Cuentas

**Ruta:** `/company/accounting/accounts`
**Archivos:** `features/accounts/`

Estructura jerarquica (arbol) donde cada cuenta puede tener cuentas hijas (`parentId` self-referential).

### Tipos de Cuenta

| Tipo | Naturaleza | Descripcion |
|------|-----------|-------------|
| ASSET | DEBIT | Activo |
| LIABILITY | CREDIT | Pasivo |
| EQUITY | CREDIT | Patrimonio Neto |
| REVENUE | CREDIT | Ingresos |
| EXPENSE | DEBIT | Egresos |

### Reglas

- Codigo unico por empresa
- Naturaleza debe coincidir con el tipo (fija, no configurable)
- No se puede eliminar si tiene sub-cuentas o lineas de asiento
- Eliminacion soft (isActive = false)

---

## Asientos Contables

**Ruta:** `/company/accounting/entries`
**Archivos:** `features/entries/`

### Ciclo de Vida

```
DRAFT ──(post)──> POSTED ──(reverse)──> REVERSED
```

### Reglas de Validacion

1. Minimo 2 lineas
2. Debe = Haber (tolerancia ±0.01)
3. Cada linea tiene Debe XOR Haber (no ambos, no ninguno)
4. Montos positivos
5. Fecha dentro del ejercicio fiscal
6. Cuentas deben existir, estar activas y pertenecer a la empresa

### Asientos Automaticos

Se generan al confirmar documentos comerciales (ver [Modulo Comercial](commercial.md#integracion-contable)):
- Facturas de venta/compra
- Recibos de cobro
- Ordenes de pago
- Gastos

Creados como `isAutomatic = true`, `createdBy = 'system'`.

### Reversion

Solo asientos POSTED pueden reversarse. La reversion:
1. Crea un nuevo asiento con Debe/Haber invertidos
2. Marca el original como REVERSED con `reversalEntryId`
3. El nuevo asiento se crea como POSTED directamente

### Numeracion

Secuencial por empresa, gestionada por `AccountingSettings.lastEntryNumber`. Se incrementa atomicamente dentro de `$transaction`.

---

## Asientos Recurrentes

**Ruta:** `/company/accounting/recurring-entries`
**Archivos:** `features/recurring-entries/`

Templates de asientos que se generan periodicamente.

### Frecuencias

MONTHLY, BIMONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL

### Flujo

1. Crear template con lineas (mismas reglas de balance)
2. Configurar frecuencia y fecha de inicio/fin
3. Generar: crea un asiento DRAFT desde el template
4. El asiento generado debe postearse manualmente
5. `nextDueDate` avanza segun la frecuencia
6. `generateAllPendingRecurringEntries()` genera todos los pendientes en batch

---

## Cierre de Ejercicio Fiscal

**Ruta:** `/company/accounting/fiscal-year-close`
**Archivos:** `features/fiscal-year-close/`

### Flujo

1. **Preview:** Calcula las lineas de cierre sin comprometer
2. **Cerrar:** Crea un asiento POSTED que:
   - Para cada cuenta de REVENUE y EXPENSE con saldo no-cero, crea una linea que la lleva a cero
   - Crea una linea en la cuenta de Resultado que captura el neto (ganancia en Haber, perdida en Debe)

### Requisitos

- `AccountingSettings.resultAccountId` debe estar configurado
- No se puede cerrar dos veces (detecta asiento de cierre existente)
- El asiento se fecha al `fiscalYearEnd`

---

## Reportes

**Ruta:** `/company/accounting/reports`
**Archivos:** `features/reports/`

### Reportes Financieros

| Reporte | Descripcion |
|---------|-------------|
| Balance de Sumas y Saldos | Debe/Haber/Saldo por cuenta, con verificacion de ecuacion contable |
| Balance General | Activo = Pasivo + PN (solo cuentas ASSET, LIABILITY, EQUITY) |
| Estado de Resultados | Ingresos - Egresos = Resultado Neto |
| Libro Diario | Todos los asientos POSTED en rango de fecha |
| Libro Mayor | Movimientos por cuenta con saldo acumulado |

### Reportes de Bienes de Uso

| Reporte | Descripcion |
|---------|-------------|
| Registro de Bienes de Uso | Listado de activos fijos con valor bruto, depreciacion acumulada, valor neto y progreso |
| Depreciaciones del Periodo | Periodos de depreciacion contabilizados en un rango de fechas con montos y asientos |

### Reportes de Auditoria

| Reporte | Descripcion |
|---------|-------------|
| Asientos sin Respaldo | Asientos no vinculados a documentos comerciales |
| Registro de Reversiones | Asientos REVERSED con metadata de reversion |
| Trazabilidad Doc-Asiento | Cruce entre documentos comerciales y sus asientos |

Todos los reportes solo consideran asientos POSTED.

---

## Configuracion

**Ruta:** `/company/accounting/settings`
**Archivos:** `features/settings/`

### Ejercicio Fiscal

- Fecha de inicio y fin (maximo 366 dias)

### Mapeo de Cuentas

Cuentas contables asignadas a funciones del sistema:

| Campo | Funcion |
|-------|---------|
| `salesAccountId` | Ventas |
| `purchasesAccountId` | Compras |
| `receivablesAccountId` | Cuentas por Cobrar |
| `payablesAccountId` | Cuentas por Pagar |
| `vatDebitAccountId` | IVA Debito Fiscal |
| `vatCreditAccountId` | IVA Credito Fiscal |
| `defaultCashAccountId` | Caja (default) |
| `defaultBankAccountId` | Banco (default) |
| `expensesAccountId` | Gastos Operativos |
| `resultAccountId` | Resultado del Ejercicio |

### Cuentas de Retenciones (8 campos)

- Emitidas: IVA, Ganancias, IIBB, SUSS
- Sufridas: IVA, Ganancias, IIBB, SUSS

### Cuentas de Activos Fijos (4 campos)

| Campo | Funcion | Tipo Cuenta |
|-------|---------|-------------|
| `fixedAssetAccountId` | Bienes de Uso | ASSET |
| `accumulatedDepreciationAccountId` | Depreciacion Acumulada | ASSET |
| `depreciationExpenseAccountId` | Gasto de Depreciacion | EXPENSE |
| `assetDisposalGainLossAccountId` | Resultado Venta/Baja | REVENUE/EXPENSE |

Sin estas cuentas configuradas, los asientos de depreciacion y baja de activos no se generan (degradacion suave).
