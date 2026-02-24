# Modulo Equipamiento

**Rutas:** `/dashboard/equipment`, `/dashboard/equipment/new`, `/dashboard/equipment/[id]`, `/dashboard/equipment/[id]/edit`
**Archivos:** `src/modules/equipment/`

El modelo Prisma subyacente es `Vehicle`. El modulo distingue entre "Vehiculos" y "Otros equipos" via `TypeOfVehicle`.

---

## Features

### Lista (`features/list/`)

- Tabs: Todos, Vehiculos, Otros
- Tabla paginada server-side con busqueda (numero interno, dominio, chasis, motor)
- Filtros: estado, condicion, tipo, marca, activo/inactivo
- Exportacion a Excel
- Soft-delete (con motivo de baja)
- Reactivacion de equipos dados de baja

### Crear (`features/create/`)

- Creacion con campos completos
- Asociacion a contratistas (relacion N:M via `ContractorVehicle`)
- Estado inicial: `INCOMPLETE`, condicion: `OPERATIVE`

### Detalle (`features/detail/`)

- Informacion completa del vehiculo/equipo
- Estado de cumplimiento documental
- Codigo QR para acceso publico

### Editar (`features/edit/`)

- Actualiza vehiculo + re-crea relaciones de contratistas en transaccion

## Campos del Vehiculo/Equipo

**Identificacion:** numero interno, dominio/patente, chasis, motor, serie, ano, kilometraje
**Estado:** status (VehicleStatus), condicion (VehicleCondition)
**Titularidad:** tipo (propia/leasing/tercero), titular, contrato (fechas, moneda, precio)
**Relaciones:** marca, modelo, tipo de equipo, tipo de vehiculo, centro de costo, sector, tipo operativo, contratistas

## Estados y Condiciones

**VehicleStatus:** ACTIVE, INACTIVE, MAINTENANCE, RETIRED
**VehicleCondition:** EXCELLENT, GOOD, FAIR, POOR, OPERATIVE
**Motivos de baja:** SALE, TOTAL_LOSS, RETURN, OTHER

## QR Publico

Cada equipo tiene un codigo QR que apunta a `/eq/[id]` (ruta publica, sin autenticacion). Permite:
- Descargar como PNG (alta resolucion)
- Imprimir directamente
- Copiar URL al portapapeles

## Documentos del Equipo

Gestionados desde el modulo Documents. Rutas: `/dashboard/equipment/[id]/documents`

## Depreciacion (`features/depreciation/`)

Gestion de depreciacion de activos fijos con integracion contable.

### Modelos

| Modelo | Descripcion |
|--------|-------------|
| `VehicleDepreciation` | Configuracion de depreciacion de un equipo (metodo, valores, vida util) |
| `DepreciationScheduleEntry` | Periodo individual del schedule (monto, fecha, estado contable) |
| `AssetValueAdjustment` | Ajuste de valor del activo (revaluacion/deterioro) |

### Metodos de Depreciacion

- **Linea Recta** (`STRAIGHT_LINE`): (grossValue - salvageValue) / usefulLifeMonths
- **Saldo Decreciente** (`DECLINING_BALANCE`): bookValue * (annualRate / 12)

### Flujo

1. Configurar depreciacion en el tab "Depreciacion" del detalle del equipo
2. Se genera automaticamente el schedule completo (todos los periodos)
3. Contabilizar periodos individualmente o en lote ("Contabilizar Depreciaciones" en listado)
4. Al contabilizar, se genera asiento: Gasto Depreciacion (Debe) / Depreciacion Acumulada (Haber)
5. Ajustes de valor recalculan el schedule desde el periodo siguiente

### Estados

- `ACTIVE`: Depreciacion en curso
- `COMPLETED`: Vida util agotada o equipo dado de baja
- `SUSPENDED`: Depreciacion pausada temporalmente

### Integracion Contable

Cuentas configuradas en Contabilidad > Configuracion > Activos Fijos:

| Cuenta | Uso |
|--------|-----|
| Bienes de Uso (ASSET) | Valor del activo fijo |
| Depreciacion Acumulada (ASSET) | Acumulado de depreciacion (contra-activo) |
| Gasto de Depreciacion (EXPENSE) | Gasto mensual de depreciacion |
| Resultado Venta/Baja (REVENUE/EXPENSE) | Ganancia o perdida por venta/baja |

Al dar de baja un equipo (`softDeleteVehicle`), se generan asientos automaticos segun el motivo:
- **Venta**: Reversa activo fijo, depreciacion acumulada, registra ganancia/perdida
- **Perdida total/Devolucion**: Reversa activo fijo y depreciacion acumulada

### Reportes

- **Registro de Bienes de Uso**: Listado de todos los activos con valores brutos, depreciacion acumulada y valor neto
- **Depreciaciones del Periodo**: Detalle de periodos contabilizados en un rango de fechas

Ambos reportes disponibles en Contabilidad > Informes > seccion "Bienes de Uso".

---

## Server Actions Principales

| Funcion | Descripcion |
|---------|-------------|
| `getEquipmentPaginated` | Lista paginada con tabs y filtros |
| `getEquipmentTabCounts` | Conteo para tabs (todos, vehiculos, otros) |
| `createVehicle` | Crear vehiculo + relaciones de contratistas |
| `getVehicleById` | Detalle con todas las relaciones |
| `updateVehicle` | Actualizar en transaccion |
| `softDeleteVehicle` | Baja con motivo (+ asiento contable si tiene depreciacion) |
| `reactivateVehicle` | Reactivar equipo dado de baja |
| `createVehicleDepreciation` | Configurar depreciacion + generar schedule |
| `updateVehicleDepreciation` | Actualizar configuracion + regenerar schedule |
| `postDepreciationEntry` | Contabilizar un periodo individual |
| `postAllPendingDepreciations` | Contabilizacion masiva de periodos pendientes |
| `createValueAdjustment` | Ajustar valor del activo + recalcular schedule |
