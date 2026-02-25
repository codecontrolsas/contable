# Documentacion de Usuario

**Fecha de inicio:** 2026-02-25
**Estado:** Completado

---

## 1. Analisis

### 1.1 Problema

La documentacion de usuario final (la guia que los usuarios ven dentro de la aplicacion en `/dashboard/help`) no se esta actualizando cuando se implementan nuevas funcionalidades. Cada vez que se agrega un modulo, feature o sub-feature, la guia de usuario queda desactualizada respecto al estado real del sistema. No existe ninguna regla en CLAUDE.md ni en `.claude/rules/` que obligue a actualizar la documentacion de usuario al implementar cambios.

Actualmente existe una regla para documentacion del **desarrollador** (regla 8 en CLAUDE.md: "Documentacion del Desarrollador con Cada Cambio"), pero NO hay regla equivalente para la documentacion del **usuario final**.

### 1.2 Contexto actual

La documentacion de usuario existe como un modulo dentro de la aplicacion:

**Ubicacion:** `src/modules/help/features/guide/`

**Estructura:**
```
src/modules/help/
  features/
    guide/
      HelpGuide.tsx                    # Server Component principal
      components/
        _HelpGuideTabs.tsx             # Tabs de navegacion (Client Component)
        _GettingStarted.tsx            # Primeros pasos
        _DashboardGuide.tsx            # Guia del Dashboard
        _EmployeesGuide.tsx            # Guia de Empleados
        _EquipmentGuide.tsx            # Guia de Equipamiento
        _DocumentsGuide.tsx            # Guia de Documentos
        _CommercialGuide.tsx           # Guia de Comercial
        _TreasuryGuide.tsx             # Guia de Tesoreria
        _AccountingGuide.tsx           # Guia de Contabilidad
        _CompanyGuide.tsx              # Guia de Empresa
      index.ts
  index.ts
```

**Acceso:** Los usuarios acceden via `/dashboard/help` en la aplicacion. La pagina renderiza `HelpGuide.tsx` que muestra un sistema de tabs con 9 secciones.

**Secciones documentadas actualmente (9 tabs):**
1. Primeros Pasos (inicio)
2. Dashboard
3. Empleados
4. Equipamiento
5. Documentos
6. Comercial
7. Tesoreria
8. Contabilidad
9. Empresa

### 1.3 Archivos involucrados

**Archivos de documentacion de usuario existentes:**
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/HelpGuide.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_HelpGuideTabs.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_GettingStarted.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_DashboardGuide.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_EmployeesGuide.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_EquipmentGuide.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_DocumentsGuide.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_CommercialGuide.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_TreasuryGuide.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_AccountingGuide.tsx`
- `/media/fabricio/E/dev/baxer-n/src/modules/help/features/guide/components/_CompanyGuide.tsx`

**Archivos que se veran afectados por la nueva regla:**
- `/media/fabricio/E/dev/baxer-n/CLAUDE.md` (agregar regla de documentacion de usuario)
- Potencialmente `.claude/rules/` (nueva regla dedicada)

**Pagina de la ruta:**
- `/media/fabricio/E/dev/baxer-n/src/app/(core)/dashboard/help/page.tsx`

### 1.4 Dependencias

- La documentacion de usuario depende de shadcn/ui components (Card, Alert, Badge, Separator, Tabs)
- Usa `lucide-react` para iconos
- Usa el componente custom `UrlTabs` para navegacion por tabs con parametros URL
- No tiene dependencias de datos (es contenido estatico hardcodeado en JSX)

### 1.5 Restricciones y reglas

**Regla actual de documentacion del desarrollador (CLAUDE.md regla 8):**
```
// Al hacer cambios significativos, actualizar docs/ correspondiente:
// Nuevo modulo         -> docs/modules/{modulo}.md + docs/architecture/data-model.md
// Nuevo modelo Prisma  -> docs/architecture/data-model.md
// Cambio en permisos   -> docs/architecture/auth-and-permissions.md
// Cambio en infra      -> docs/infrastructure/
// Cambio en shared/    -> docs/architecture/project-structure.md
// Nueva convencion     -> docs/conventions/
```

**NO existe** regla equivalente para documentacion de usuario.

**Reglas de estructura que aplican:**
- Los componentes del modulo help siguen la estructura correcta de features
- Los componentes client usan prefijo `_` correctamente
- El modulo esta en `src/modules/help/` (correcto segun la arquitectura)

### 1.6 Riesgos identificados

1. **Documentacion desactualizada genera confusion**: Los usuarios ven guias que no mencionan funcionalidades que ya existen, o describen flujos que han cambiado.

2. **Gap significativo ya existente**: Se identificaron multiples funcionalidades implementadas que NO estan documentadas en la guia de usuario (detalle abajo).

3. **Crecimiento continuo**: Cada nuevo commit agrega features sin tocar la guia.

4. **Contenido hardcodeado en JSX**: La documentacion es codigo React puro (no Markdown ni CMS), lo que hace que los cambios requieran editar componentes TSX. Esto puede ser una barrera si el desarrollador no esta familiarizado con la estructura.

5. **Complejidad de mantenimiento**: A medida que el sistema crece, mantener ~10 archivos de guia sincronizados con ~50+ features es un reto.

---

## 1.7 Gap Analysis: Funcionalidades NO documentadas en la guia de usuario

### Modulo Comercial - Gaps

| Funcionalidad | Ruta/Feature | Estado en guia |
|---|---|---|
| **Ordenes de Compra** | `/commercial/purchase-orders/` | NO documentado |
| **Remitos de Recepcion** | `/commercial/receiving-notes/` | NO documentado |
| **Almacenes (CRUD, detalle, movimientos, stock)** | `/commercial/warehouses/`, `/commercial/stock/` | NO documentado |
| **Listas de Precios** | `/commercial/price-lists/` | NO documentado |
| **Categorias de Productos (arbol)** | `/commercial/categories/` | Mencionado brevemente, sin guia de uso |
| **Gastos** | `/commercial/expenses/` | NO documentado |
| **Movimientos de Stock** | `/commercial/movements/` | NO documentado |
| **Reportes de Compras** | `/commercial/purchase-reports/` | Mencionado brevemente |
| **Contactos (CRM)** | `/company/commercial/contacts/` | NO documentado |
| **Leads (CRM)** | `/company/commercial/leads/` | NO documentado |
| **Cotizaciones (CRM)** | `/company/commercial/quotes/` | NO documentado |
| **Puntos de Venta (configuracion)** | `/commercial/points-of-sale/` | Mencionado brevemente, sin guia |

### Modulo Contabilidad - Gaps

| Funcionalidad | Ruta/Feature | Estado en guia |
|---|---|---|
| **Presupuestos y Control Presupuestario** | `/company/accounting/budgets/` | NO documentado (commit mas reciente) |
| **Bloqueo de Periodos Contables** | Dentro de settings | NO documentado (commit reciente) |
| **Depreciacion de Activos Fijos** | Integrado en equipamiento | NO documentado (commit reciente) |
| **Saldos Iniciales / Apertura** | `/company/accounting/opening-balances/` | NO documentado |
| **Plan de Depreciacion de Equipos** | Integrado en equipamiento/contabilidad | NO documentado |

### Modulo Tesoreria - Gaps

| Funcionalidad | Ruta/Feature | Estado en guia |
|---|---|---|
| **Cheques (propios y terceros)** | `/commercial/treasury/checks/` | NO documentado |
| **Cajas Registradoras** | `/commercial/treasury/cash-registers/` | NO documentado |
| **Sesiones de Caja** | Feature sessions en treasury | NO documentado |
| **Flujo de Caja (Cashflow)** | `/commercial/treasury/cashflow/` | NO documentado |
| **Proyecciones de Cashflow** | `/commercial/treasury/projections/` | NO documentado |

### Modulo Empresa/Company - Gaps

| Funcionalidad | Ruta/Feature | Estado en guia |
|---|---|---|
| **Auditoria general del sistema** | `/company/general/audit/` | Mencionado brevemente, sin guia detallada |
| **Gestion de Empresas (multi-empresa)** | `/companies/` (CRUD) | NO documentado |

### Resumen del Gap

- **Total de funcionalidades/sub-modulos identificados en rutas:** ~45+
- **Funcionalidades documentadas en guia de usuario:** ~20 (estimado)
- **Funcionalidades NO documentadas o insuficientemente documentadas:** ~25+
- **Porcentaje de cobertura estimado:** ~45%

Los 3 commits mas recientes (presupuestos, bloqueo de periodos, depreciacion de activos) NO tienen documentacion de usuario alguna.

---

## 1.8 Propuesta de Regla para CLAUDE.md

Se propone agregar una nueva regla de oro (regla 10) en CLAUDE.md:

```markdown
### 10. Documentacion de Usuario con Cada Cambio

Al implementar una nueva funcionalidad visible para el usuario o modificar una existente,
SIEMPRE actualizar la guia de usuario en `src/modules/help/features/guide/components/`:

// Nueva feature en modulo existente  -> Actualizar el _*Guide.tsx correspondiente
// Nuevo modulo                        -> Crear nuevo _*Guide.tsx + agregar tab en _HelpGuideTabs.tsx
// Cambio en flujo/UI                  -> Actualizar pasos y descripciones en la guia
// Nuevo boton/accion visible          -> Documentar en la seccion correspondiente
// Eliminacion de feature              -> Remover de la guia

La guia debe describir:
- QUE hace la funcionalidad (en lenguaje simple para el usuario final)
- COMO usarla paso a paso
- Relacion con otros modulos (si aplica)
- Estados y flujos (si aplica)
```

Tambien se propone agregar al checklist de commit:
```markdown
- [ ] Guia de usuario actualizada si hay cambios visibles para el usuario (`src/modules/help/`)
```

---

## 2. Planificacion

### 2.1 Fases de implementacion

#### Fase 0: Regla de documentacion de usuario en CLAUDE.md y checklist

- **Objetivo:** Prevenir futuros gaps estableciendo una regla obligatoria que vincule cada cambio visible al usuario con la actualizacion de la guia de ayuda. Esto es lo mas importante porque evita que el problema se repita.
- **Tareas:**
  - [x] Agregar regla 10 "Documentacion de Usuario con Cada Cambio" en la seccion "Reglas de Oro (Siempre Activas)" de CLAUDE.md, usando el texto propuesto en la seccion 1.8 de este documento
  - [x] Agregar item al checklist antes de commit en CLAUDE.md: `- [ ] Guia de usuario actualizada si hay cambios visibles para el usuario (src/modules/help/)`
  - [x] Crear archivo `.claude/rules/user-documentation.md` con regla dedicada que detalle: cuando actualizar, que archivo modificar segun el modulo, como seguir el patron JSX existente (Card + CardHeader + CardContent, listas ordenadas para pasos, listas desordenadas para opciones, Badge para estados, Alert para relaciones entre modulos)
- **Archivos:**
  - `CLAUDE.md` (modificar)
  - `.claude/rules/user-documentation.md` (crear)
- **Criterio de completitud:** La regla existe en CLAUDE.md, el checklist tiene el item, y el archivo de regla `.claude/rules/user-documentation.md` existe con instrucciones claras y ejemplos del patron JSX

---

#### Fase 1: Modulo Comercial - Ordenes de compra, remitos y almacenes

- **Objetivo:** Documentar el ciclo completo de compras (OC -> Remito -> Factura) y la gestion de almacenes/stock que actualmente no estan en la guia.
- **Tareas:**
  - [x] Agregar seccion "Ordenes de Compra" en `_CommercialGuide.tsx`: crear Card con icono `ClipboardList`, descripcion del flujo (crear OC, seleccionar proveedor, agregar lineas de productos, estados Borrador/Confirmada/Parcialmente Recibida/Completada, relacion con remitos de recepcion)
  - [x] Agregar seccion "Remitos de Recepcion" en `_CommercialGuide.tsx`: crear Card con icono `PackageCheck`, flujo de recepcion (crear desde OC o manual, seleccionar proveedor, indicar productos recibidos y cantidades, estados, vinculacion con OC y factura de compra)
  - [x] Agregar seccion "Almacenes" en `_CommercialGuide.tsx`: crear Card con icono `Warehouse`, CRUD de almacenes, detalle con pestanas (stock, movimientos), como ver stock por producto
  - [x] Agregar seccion "Stock y Movimientos de Stock" en `_CommercialGuide.tsx`: crear Card con icono `ArrowLeftRight`, tipos de movimiento (entrada, salida, transferencia, ajuste), como se generan automaticamente desde remitos/facturas, consulta de stock global
  - [x] Actualizar el Alert de "Relacion con otros modulos" al final de `_CommercialGuide.tsx` para incluir el flujo OC -> Remito -> Factura -> Pago
- **Archivos:**
  - `src/modules/help/features/guide/components/_CommercialGuide.tsx` (modificar)
- **Criterio de completitud:** Las 4 secciones nuevas (OC, Remitos, Almacenes, Stock) aparecen como Cards en la guia Comercial, cada una con pasos de uso y descripcion de estados

---

#### Fase 2: Modulo Comercial - Listas de precios, categorias, gastos y puntos de venta

- **Objetivo:** Documentar funcionalidades secundarias del modulo comercial que faltan o estan insuficientemente documentadas.
- **Tareas:**
  - [x] Agregar seccion "Listas de Precios" en `_CommercialGuide.tsx`: crear Card con icono `Tags`, como crear una lista, asignar precios por producto, vincular a clientes, tipos (porcentaje sobre precio base, precio fijo)
  - [x] Ampliar seccion existente de "Productos" en `_CommercialGuide.tsx` para mencionar explicitamente la gestion de categorias en arbol (crear categorias padre/hijo, asignar productos a categorias, navegar el arbol)
  - [x] Agregar seccion "Gastos" en `_CommercialGuide.tsx`: crear Card con icono `Banknote`, registrar gastos del negocio (proveedor opcional, fecha, monto, categoria, estado, vinculacion con ordenes de pago)
  - [x] Ampliar la mencion de "Puntos de Venta" en `_CommercialGuide.tsx`: crear Card con icono `Store`, como configurar puntos de venta (numero, nombre, tipos de comprobante habilitados, numeracion automatica)
- **Archivos:**
  - `src/modules/help/features/guide/components/_CommercialGuide.tsx` (modificar)
- **Criterio de completitud:** Las secciones de Listas de Precios, Gastos y Puntos de Venta aparecen como Cards nuevas; la seccion de Productos menciona categorias en arbol

---

#### Fase 3: Modulo Comercial - CRM (Contactos, Leads, Cotizaciones)

- **Objetivo:** Documentar las funcionalidades de CRM que estan en la ruta `/company/commercial/` y no tienen documentacion alguna.
- **Tareas:**
  - [x] Agregar seccion "CRM - Contactos" en `_CommercialGuide.tsx`: crear Card con icono `Contact`, registro de contactos comerciales, campos principales, vinculacion con clientes/leads
  - [x] Agregar seccion "CRM - Leads" en `_CommercialGuide.tsx`: crear Card con icono `UserSearch`, registro de oportunidades comerciales, estados del lead, seguimiento
  - [x] Agregar seccion "CRM - Cotizaciones" en `_CommercialGuide.tsx`: crear Card con icono `FileSpreadsheet`, crear cotizaciones para leads/clientes, lineas de productos, estados (Borrador, Enviada, Aceptada, Rechazada), conversion a factura
- **Archivos:**
  - `src/modules/help/features/guide/components/_CommercialGuide.tsx` (modificar)
- **Criterio de completitud:** Las 3 secciones CRM aparecen como Cards en la guia Comercial con flujos paso a paso

---

#### Fase 4: Modulo Tesoreria - Cheques, cajas registradoras, cashflow y proyecciones

- **Objetivo:** Documentar las funcionalidades de tesoreria que no estan cubiertas: cheques, cajas registradoras, sesiones de caja, flujo de caja y proyecciones.
- **Tareas:**
  - [x] Agregar seccion "Cheques" en `_TreasuryGuide.tsx`: crear Card con icono `FileCheck`, cheques propios (emitidos) y de terceros (recibidos), estados (En cartera, Depositado, Cobrado, Rechazado), como registrarlos, vinculacion con ordenes de pago y recibos
  - [x] Agregar seccion "Cajas Registradoras" en `_TreasuryGuide.tsx`: crear Card con icono `Vault`, crear cajas, asignar a puntos de venta, saldo actual, cuenta contable asociada
  - [x] Agregar seccion "Sesiones de Caja" en `_TreasuryGuide.tsx`: crear Card con icono `Clock`, abrir/cerrar sesion, monto de apertura, operaciones durante la sesion, cierre con arqueo, diferencias
  - [x] Agregar seccion "Flujo de Caja (Cashflow)" en `_TreasuryGuide.tsx`: crear Card con icono `TrendingUp`, visualizacion de ingresos y egresos por periodo, filtros por cuenta/periodo, grafico de evolucion
  - [x] Agregar seccion "Proyecciones de Cashflow" en `_TreasuryGuide.tsx`: crear Card con icono `LineChart`, crear proyecciones basadas en datos historicos y facturas pendientes, parametros configurables, comparacion proyectado vs real
  - [x] Actualizar el Alert de "Relacion con otros modulos" de `_TreasuryGuide.tsx` para mencionar cheques y cajas
- **Archivos:**
  - `src/modules/help/features/guide/components/_TreasuryGuide.tsx` (modificar)
- **Criterio de completitud:** Las 5 secciones nuevas aparecen como Cards en la guia de Tesoreria, cada una con pasos de uso y descripcion de estados cuando aplique

---

#### Fase 5: Modulo Contabilidad - Presupuestos, bloqueo de periodos, saldos iniciales y depreciacion

- **Objetivo:** Documentar las funcionalidades contables recientes (3 ultimos commits) y saldos de apertura que no estan en la guia.
- **Tareas:**
  - [x] Agregar seccion "Presupuestos y Control Presupuestario" en `_AccountingGuide.tsx`: crear Card con icono `PiggyBank`, crear presupuestos por periodo y cuentas, montos asignados vs ejecutados, alertas de sobrepaso, reportes de ejecucion presupuestaria
  - [x] Agregar seccion "Bloqueo de Periodos Contables" en `_AccountingGuide.tsx`: crear Card con icono `Lock`, como bloquear un periodo para impedir asientos retroactivos, desbloqueo, periodos abiertos vs cerrados, ubicacion dentro de Configuracion
  - [x] Agregar seccion "Saldos Iniciales / Apertura" en `_AccountingGuide.tsx`: crear Card con icono `BookOpenCheck`, como cargar saldos de apertura (importar o cargar manualmente), cuentas con saldo inicial, validacion de cuadre (debe = haber)
  - [x] Agregar seccion "Depreciacion de Activos Fijos" en `_AccountingGuide.tsx`: crear Card con icono `TrendingDown`, como se configura la depreciacion en equipos, metodos de depreciacion, plan de depreciacion, generacion automatica de asientos de depreciacion, relacion con modulo de equipamiento
  - [x] Actualizar el Alert de "Relacion con otros modulos" de `_AccountingGuide.tsx` para mencionar la depreciacion integrada con equipamiento y el control presupuestario
- **Archivos:**
  - `src/modules/help/features/guide/components/_AccountingGuide.tsx` (modificar)
- **Criterio de completitud:** Las 4 secciones nuevas aparecen como Cards en la guia de Contabilidad, con flujos paso a paso y descripcion clara para el usuario final

---

#### Fase 6: Modulo Equipamiento - Depreciacion y plan de depreciacion

- **Objetivo:** Documentar la funcionalidad de depreciacion de activos dentro de la guia de equipamiento, ya que el usuario interactua con esta funcionalidad desde el detalle del equipo.
- **Tareas:**
  - [x] Agregar seccion "Depreciacion de Equipos" en `_EquipmentGuide.tsx`: crear Card con icono `TrendingDown`, como configurar datos de depreciacion en un equipo (valor de adquisicion, fecha de adquisicion, vida util, valor residual, metodo de depreciacion), como ver el plan de depreciacion (cronograma), estado de depreciacion (activo, completado), vinculacion con asientos contables automaticos
  - [x] Actualizar el Alert de "Relacion con otros modulos" de `_EquipmentGuide.tsx` para mencionar la integracion con contabilidad via depreciacion
- **Archivos:**
  - `src/modules/help/features/guide/components/_EquipmentGuide.tsx` (modificar)
- **Criterio de completitud:** La seccion de depreciacion aparece como Card en la guia de Equipamiento con explicacion del flujo completo

---

#### Fase 7: Modulo Empresa - Auditoria general y gestion multi-empresa

- **Objetivo:** Documentar la auditoria del sistema y la gestion de multiples empresas.
- **Tareas:**
  - [x] Ampliar seccion "Auditoria de Permisos" en `_CompanyGuide.tsx` para convertirla en "Auditoria del Sistema": incluir no solo cambios de permisos sino el log general de auditoria (acciones de usuarios, cambios en registros, filtros por usuario/fecha/modulo/accion)
  - [x] Agregar seccion "Gestion de Empresas (Multi-empresa)" en `_CompanyGuide.tsx`: crear Card con icono `Building`, como crear una nueva empresa, editar datos de la empresa, cambiar entre empresas, datos de la empresa (razon social, CUIT, direccion, logo)
  - [x] Actualizar el Alert de "Relacion con otros modulos" de `_CompanyGuide.tsx` para mencionar que el cambio de empresa afecta todos los datos visibles en el sistema
- **Archivos:**
  - `src/modules/help/features/guide/components/_CompanyGuide.tsx` (modificar)
- **Criterio de completitud:** La seccion de auditoria esta ampliada y la seccion de multi-empresa aparece como Card nueva en la guia de Empresa

---

#### Fase 8: Revision final y actualizacion de Primeros Pasos

- **Objetivo:** Asegurar que la guia de Primeros Pasos refleje el estado actual del sistema y que todas las guias sean coherentes entre si.
- **Tareas:**
  - [x] Revisar `_GettingStarted.tsx` para que la lista de modulos disponibles coincida con lo documentado (agregar mencion de funcionalidades nuevas como CRM, almacenes, presupuestos, etc.)
  - [x] Verificar que los iconos de imports en cada guia modificada no tengan imports sin usar
  - [x] Ejecutar `npm run check-types` para verificar que no haya errores de TypeScript en los archivos modificados
  - [x] Ejecutar `npm run lint` para verificar que no haya errores de lint
  - [ ] Revisar visualmente la guia en el navegador navegando cada tab para confirmar renderizado correcto
- **Archivos:**
  - `src/modules/help/features/guide/components/_GettingStarted.tsx` (modificar)
  - Todos los archivos de guia modificados en fases anteriores (verificar)
- **Criterio de completitud:** check-types y lint pasan, la guia renderiza correctamente en todos los tabs, y Primeros Pasos refleja el estado actual del sistema

---

### 2.2 Orden de ejecucion

```
Fase 0 (regla CLAUDE.md)
   |
   ├── No tiene dependencias, se ejecuta primero
   |
Fase 1 (Comercial: OC, Remitos, Almacenes)
   |
Fase 2 (Comercial: Precios, Categorias, Gastos, PdV)
   |
Fase 3 (Comercial: CRM)
   |
   ├── Fases 1-3 son independientes entre si pero se agrupan
   |   por archivo (_CommercialGuide.tsx) para evitar conflictos
   |
Fase 4 (Tesoreria: Cheques, Cajas, Cashflow)
   |
   ├── Independiente de Fases 1-3
   |
Fase 5 (Contabilidad: Presupuestos, Periodos, Apertura, Depreciacion)
   |
Fase 6 (Equipamiento: Depreciacion)
   |
   ├── Fase 6 se ejecuta despues de Fase 5 porque ambas mencionan
   |   depreciacion y deben ser coherentes en la terminologia
   |
Fase 7 (Empresa: Auditoria, Multi-empresa)
   |
   ├── Independiente de Fases 4-6
   |
Fase 8 (Revision final)
   |
   ├── DEBE ejecutarse al final, despues de todas las demas fases
```

Las Fases 1-7 pueden ejecutarse en cualquier orden tras la Fase 0, pero se recomienda el orden listado para:
- Agrupar cambios por archivo (minimizar contexto de edicion)
- Mantener coherencia terminologica entre guias que se referencian mutuamente
- Facilitar revision incremental

### 2.3 Estimacion de complejidad

| Fase | Complejidad | Justificacion |
|------|-------------|---------------|
| Fase 0 | Baja | Editar CLAUDE.md y crear un archivo de regla, sin logica |
| Fase 1 | Alta | 4 secciones nuevas con flujos complejos (OC, remitos, almacenes, stock) |
| Fase 2 | Media | 3-4 secciones nuevas pero mas simples (CRUD basicos) |
| Fase 3 | Media | 3 secciones CRM, flujos moderados |
| Fase 4 | Alta | 5 secciones nuevas con flujos complejos (cheques, cajas, cashflow) |
| Fase 5 | Alta | 4 secciones nuevas con conceptos contables densos |
| Fase 6 | Baja | 1 seccion nueva, complementaria a Fase 5 |
| Fase 7 | Baja | 1 seccion nueva + ampliacion de otra existente |
| Fase 8 | Baja | Revision y verificacion, sin contenido nuevo significativo |

## 3. Diseno

### 3.1 Arquitectura de la solucion

La documentacion de usuario es contenido **estatico en JSX** renderizado dentro de componentes React client-side. No hay logica de negocio, ni fetching de datos, ni state management complejo. Cada guia es un archivo `_*Guide.tsx` que exporta un componente funcional con JSX puro.

**Patron estructural de cada guia:**
```
<div className="space-y-6">
  {/* Header del modulo */}
  <div>
    <h2>Titulo del Modulo</h2>
    <p>Descripcion breve</p>
  </div>

  {/* N Cards, una por funcionalidad */}
  <Card> ... </Card>
  <Card> ... </Card>

  {/* Separador antes del Alert final */}
  <Separator />

  {/* Alert de relacion con otros modulos */}
  <Alert> ... </Alert>
</div>
```

Cada **Card** documenta una funcionalidad y sigue un patron consistente:
- `CardHeader` con icono + titulo + descripcion opcional
- `CardContent` con pasos numerados (`<ol>`) y/o listas de opciones (`<ul>`)
- `Badge` para mostrar estados y flujos
- Texto `text-muted-foreground` para descripciones secundarias

No se crean archivos nuevos de componentes (excepto `.claude/rules/user-documentation.md`). Todo el trabajo es edicion de archivos existentes.

### 3.2 Patron JSX de referencia

A continuacion el patron exacto de una Card, extraido de las guias existentes. Todas las Cards nuevas DEBEN seguir este patron:

**Card con pasos (flujo):**
```tsx
{/* Nombre de la Funcionalidad */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <IconName className="h-5 w-5" />
      Titulo de la Funcionalidad
    </CardTitle>
    <CardDescription>
      Descripcion breve de la funcionalidad
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    <p>
      <strong>Crear un [elemento]:</strong>
    </p>
    <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
      <li>
        Ve a <strong>Modulo -> Seccion</strong>
      </li>
      <li>
        Haz clic en <strong>Nuevo [Elemento]</strong>
      </li>
      <li>
        Completa:
        <ul className="list-disc pl-6 mt-1 space-y-1">
          <li>Campo 1</li>
          <li>Campo 2</li>
        </ul>
      </li>
    </ol>

    <p className="mt-3">
      <strong>Estados:</strong>
    </p>
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">Estado1</Badge>
      <span>-></span>
      <Badge>Estado2</Badge>
      <span>-></span>
      <Badge variant="outline">Estado3</Badge>
    </div>
    <ul className="list-disc pl-6 space-y-1 text-muted-foreground mt-2">
      <li>
        <strong>Estado1</strong>: descripcion
      </li>
      <li>
        <strong>Estado2</strong>: descripcion
      </li>
    </ul>
  </CardContent>
</Card>
```

**Card sin pasos (descriptiva):**
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <IconName className="h-5 w-5" />
      Titulo
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    <p>Descripcion introductoria:</p>
    <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
      <li><strong>Opcion A</strong>: descripcion</li>
      <li><strong>Opcion B</strong>: descripcion</li>
    </ul>
  </CardContent>
</Card>
```

**Alert de relacion entre modulos (al final de cada guia):**
```tsx
<Alert>
  <Info className="h-4 w-4" />
  <AlertDescription>
    <strong>Relacion con otros modulos:</strong>
    <ul className="list-disc pl-6 mt-1 space-y-1">
      <li>
        <strong>Modulo X</strong>: descripcion de la relacion
      </li>
    </ul>
  </AlertDescription>
</Alert>
```

### 3.3 Diseno por fase

---

#### Fase 0: Regla CLAUDE.md

**Archivo: `CLAUDE.md` - Agregar regla 10 en la seccion "Reglas de Oro":**

```markdown
### 10. Documentacion de Usuario con Cada Cambio

Al implementar una nueva funcionalidad visible para el usuario o modificar una existente,
SIEMPRE actualizar la guia de usuario en `src/modules/help/features/guide/components/`:

```typescript
// Nueva feature en modulo existente  -> Actualizar el _*Guide.tsx correspondiente
// Nuevo modulo                        -> Crear nuevo _*Guide.tsx + agregar tab en _HelpGuideTabs.tsx
// Cambio en flujo/UI                  -> Actualizar pasos y descripciones en la guia
// Nuevo boton/accion visible          -> Documentar en la seccion correspondiente
// Eliminacion de feature              -> Remover de la guia
```

La guia debe describir:
- QUE hace la funcionalidad (en lenguaje simple para el usuario final)
- COMO usarla paso a paso
- Relacion con otros modulos (si aplica)
- Estados y flujos (si aplica)
```

**Archivo: `CLAUDE.md` - Agregar al checklist antes de commit:**
```markdown
- [ ] Guia de usuario actualizada si hay cambios visibles para el usuario (`src/modules/help/`)
```

**Archivo: `.claude/rules/user-documentation.md` - Crear con el siguiente contenido:**

```markdown
# Reglas de Documentacion de Usuario

## 1. Cuando actualizar la guia de usuario

| Cambio | Accion requerida |
|--------|-----------------|
| Nueva feature en modulo existente | Agregar Card en el _*Guide.tsx correspondiente |
| Nuevo modulo completo | Crear _*Guide.tsx + agregar tab en _HelpGuideTabs.tsx |
| Cambio en flujo o UI de feature | Actualizar pasos y descripciones en la Card existente |
| Nuevo boton/accion visible al usuario | Documentar en la seccion correspondiente |
| Eliminacion de feature | Remover la Card de la guia |
| Cambio de textos/labels en UI | Actualizar los textos en la guia |

## 2. Que archivo modificar segun el modulo

| Modulo | Archivo |
|--------|---------|
| Dashboard | `_DashboardGuide.tsx` |
| Empleados | `_EmployeesGuide.tsx` |
| Equipamiento | `_EquipmentGuide.tsx` |
| Documentos | `_DocumentsGuide.tsx` |
| Comercial (ventas, compras, CRM, almacenes, etc.) | `_CommercialGuide.tsx` |
| Tesoreria (cuentas bancarias, cobros, pagos, etc.) | `_TreasuryGuide.tsx` |
| Contabilidad | `_AccountingGuide.tsx` |
| Empresa (usuarios, roles, catalogos) | `_CompanyGuide.tsx` |
| Primeros pasos / vista general | `_GettingStarted.tsx` |

## 3. Patron JSX obligatorio

Cada funcionalidad se documenta como una Card:

- `CardHeader`: icono de lucide-react (h-5 w-5) + titulo + CardDescription opcional
- `CardContent className="space-y-3"`: contenido
  - Pasos numerados: `<ol className="list-decimal pl-6 space-y-2 text-muted-foreground">`
  - Opciones/campos: `<ul className="list-disc pl-6 mt-1 space-y-1">`
  - Estados: `<Badge>` con variantes secondary (borrador), default (activo), outline (parcial), destructive (cancelado)
  - Flujo de estados: `<div className="flex flex-wrap gap-2">` con Badges y `<span>-></span>`
  - Notas: `<p className="text-sm text-muted-foreground">`

Al final de cada guia, antes del cierre del div principal:
- `<Separator />`
- `<Alert>` con Info icon y lista de relaciones con otros modulos

## 4. Lenguaje

- Escribir en espanol, en segunda persona informal (tu/vos)
- Usar lenguaje simple para usuario final, NO tecnico
- Describir QUE hace, COMO usarlo paso a paso
- Mencionar estados y sus transiciones cuando aplique
- Referenciar rutas de navegacion en negrita: **Comercial -> Productos**

## 5. Imports

Cada guia importa de:
- `lucide-react`: iconos necesarios
- `@/shared/components/ui/alert`: Alert, AlertDescription
- `@/shared/components/ui/badge`: Badge (solo si hay estados)
- `@/shared/components/ui/card`: Card, CardContent, CardDescription, CardHeader, CardTitle
- `@/shared/components/ui/separator`: Separator
```

**Archivo: `CLAUDE.md` - Agregar en la tabla de reglas criticas:**
```markdown
| Doc. Usuario | `@.claude/rules/user-documentation.md` | Actualizar guia de usuario con cada cambio visible |
```

---

#### Fase 1: Comercial - OC, Remitos, Almacenes, Stock

**Archivo:** `src/modules/help/features/guide/components/_CommercialGuide.tsx`

**Imports a agregar:**
```tsx
import {
  ArrowLeftRight,
  ClipboardList,
  FileText,
  Info,
  Package,
  PackageCheck,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react';
```
(Se agregan: `ClipboardList`, `PackageCheck`, `Warehouse`, `ArrowLeftRight`)

**Card 1: Ordenes de Compra** (insertar despues de la Card "Facturas de Compra")

- Icono: `ClipboardList`
- Titulo: "Ordenes de Compra"
- CardDescription: "Solicitudes de compra a proveedores"
- Contenido:
  - Texto intro: "Las ordenes de compra (OC) permiten formalizar un pedido a un proveedor antes de recibir la mercaderia o la factura."
  - Pasos para crear:
    1. Ve a **Comercial -> Compras -> Ordenes de Compra**
    2. Haz clic en **Nueva Orden de Compra**
    3. Selecciona el **proveedor**
    4. Indica la **fecha de emision** y opcionalmente la **fecha de entrega esperada**
    5. Agrega **lineas de productos**: descripcion, cantidad, costo unitario, alicuota IVA
    6. Opcionalmente, configura **cuotas de pago** (semanal, quincenal o mensual)
    7. Agrega **condiciones de pago**, **direccion de entrega** y **notas** si corresponde
    8. Haz clic en **Guardar** (queda en Borrador)
  - Estados:
    - `Badge variant="secondary"`: Borrador
    - `->` `Badge variant="outline"`: Pendiente de Aprobacion
    - `->` `Badge`: Aprobada
    - `->` `Badge`: Recibida Parcialmente
    - `->` `Badge`: Completada
    - Tambien: `Badge variant="destructive"`: Cancelada
  - Lista de estados con descripcion:
    - **Borrador**: se puede editar libremente
    - **Pendiente de Aprobacion**: requiere aprobacion para continuar
    - **Aprobada**: lista para recibir mercaderia
    - **Recibida Parcialmente**: se generaron remitos parciales
    - **Completada**: toda la mercaderia fue recibida
    - **Cancelada**: la OC fue anulada
  - Texto nota: "Desde el detalle de la OC puedes vincular facturas de compra y ver el estado de facturacion (Sin facturar, Parcialmente facturada, Totalmente facturada)."

**Card 2: Remitos de Recepcion** (insertar despues de Card OC)

- Icono: `PackageCheck`
- Titulo: "Remitos de Recepcion"
- CardDescription: "Registro de mercaderia recibida de proveedores"
- Contenido:
  - Texto intro: "Los remitos registran la recepcion fisica de productos en un almacen. Pueden crearse desde una orden de compra o de forma independiente."
  - Pasos para crear:
    1. Ve a **Comercial -> Compras -> Remitos de Recepcion**
    2. Haz clic en **Nuevo Remito**
    3. Selecciona el **proveedor**
    4. Selecciona el **almacen** donde se recibira la mercaderia
    5. Opcionalmente, vincula a una **Orden de Compra** o **Factura de Compra** (no ambas)
    6. Indica la **fecha de recepcion**
    7. Agrega las **lineas**: producto, cantidad recibida, notas
    8. Haz clic en **Guardar** (queda en Borrador)
  - Estados:
    - `Badge variant="secondary"`: Borrador
    - `->` `Badge`: Confirmado
    - Tambien: `Badge variant="destructive"`: Anulado
  - Lista de estados:
    - **Borrador**: se puede editar
    - **Confirmado**: se actualiza el stock del almacen automaticamente
    - **Anulado**: se revierten los movimientos de stock
  - Texto nota: "Al confirmar un remito vinculado a una OC, se actualizan las cantidades recibidas en la orden y su estado puede pasar a Recibida Parcialmente o Completada."

**Card 3: Almacenes** (insertar despues de Card Remitos)

- Icono: `Warehouse`
- Titulo: "Almacenes"
- CardDescription: "Gestion de depositos y ubicaciones de stock"
- Contenido:
  - Pasos para crear:
    1. Ve a **Comercial -> Almacenes**
    2. Haz clic en **Nuevo Almacen**
    3. Completa:
      - Codigo (unico)
      - Nombre
      - Tipo: Principal, Sucursal, En Transito o Virtual
      - Direccion, ciudad, provincia (opcionales)
  - Texto: "El **detalle** del almacen muestra:"
  - Lista:
    - **Stock**: productos almacenados con cantidad total, reservada y disponible
    - **Movimientos**: historial de entradas, salidas, transferencias y ajustes
  - Texto nota: "Solo los productos con la opcion 'Controla stock' activada aparecen en los almacenes."

**Card 4: Stock y Movimientos de Stock** (insertar despues de Card Almacenes)

- Icono: `ArrowLeftRight`
- Titulo: "Stock y Movimientos"
- CardDescription: "Control de inventario y trazabilidad de movimientos"
- Contenido:
  - Texto: "Desde **Comercial -> Stock** puedes consultar el inventario global:"
  - Lista de vistas:
    - **Por Producto**: stock total de un producto en todos los almacenes
    - **Por Almacen**: stock de todos los productos en un almacen especifico
  - Texto: "**Tipos de movimiento de stock:**"
  - Lista:
    - **Compra**: entrada automatica al confirmar remitos de recepcion
    - **Venta**: salida automatica al confirmar facturas con control de stock
    - **Ajuste**: correccion manual de cantidades (positivo o negativo)
    - **Transferencia Salida / Entrada**: mover stock entre almacenes
    - **Devolucion**: productos devueltos
    - **Perdida/Merma**: registrar perdidas de inventario
  - Texto: "Las **transferencias** y **ajustes** manuales se realizan desde **Comercial -> Movimientos de Stock** usando los botones correspondientes."

**Actualizar el Alert de relacion con otros modulos** al final de `_CommercialGuide.tsx` para agregar:
- **Ordenes de Compra**: el flujo completo es OC -> Remito de Recepcion -> Factura de Compra -> Orden de Pago
- **Almacenes**: los remitos de recepcion generan entradas de stock automaticamente al confirmarse

---

#### Fase 2: Comercial - Precios, Categorias, Gastos, PdV

**Archivo:** `src/modules/help/features/guide/components/_CommercialGuide.tsx`

**Imports adicionales a agregar:**
```tsx
import {
  FolderTree,
  Receipt as ReceiptIcon,
  Store,
  Tags,
} from 'lucide-react';
```
(Se agregan: `Tags`, `FolderTree`, `Store`. Nota: `Receipt` ya esta importado, usar alias `ReceiptIcon` si es necesario para gastos, o usar otro icono. Dado que `Receipt` ya se usa para Cuenta Corriente, para Gastos usar `Receipt` con un nombre distinto. Revision: para Gastos usar el icono `CreditCard` ya que Receipt ya esta en uso. Alternativamente, dado que hay riesgo de conflicto, usar `Banknote` para Gastos.)

Revision de imports: para evitar conflictos con `Receipt` ya importado, los iconos adicionales son:
```tsx
import { Banknote, FolderTree, Store, Tags } from 'lucide-react';
```

**Card 5: Listas de Precios** (insertar despues de la Card "Productos")

- Icono: `Tags`
- Titulo: "Listas de Precios"
- CardDescription: "Precios diferenciados para tus clientes"
- Contenido:
  - Texto intro: "Las listas de precios permiten definir precios especiales por producto, que se aplican automaticamente al facturar segun el cliente."
  - Pasos para crear:
    1. Ve a **Comercial -> Listas de Precios**
    2. Haz clic en **Nueva Lista**
    3. Ingresa el **nombre** y opcionalmente una **descripcion**
    4. Marca como **lista por defecto** si corresponde
    5. En el **detalle** de la lista, agrega productos con su precio especial
  - Texto: "Cada item de la lista tiene:"
  - Lista:
    - **Producto**: selecciona del catalogo
    - **Precio sin IVA**: el precio especial para esta lista
    - **Precio con IVA**: se calcula automaticamente segun la alicuota del producto
  - Texto nota: "Al asignar una lista de precios a un cliente, las facturas de venta usaran automaticamente los precios de esa lista."

**Ampliar la Card existente de "Productos"** para mencionar categorias:

Agregar al final del `CardContent` de la Card de Productos, antes del cierre:
```
<p className="mt-3">
  <strong>Categorias de Productos:</strong>
</p>
<ul className="list-disc pl-6 space-y-1 text-muted-foreground">
  <li>
    Desde <strong>Comercial -> Categorias</strong> puedes organizar los
    productos en una estructura de arbol jerarquico
  </li>
  <li>
    Cada categoria puede tener <strong>subcategorias</strong> (categoria
    padre/hijo)
  </li>
  <li>
    Al crear o editar un producto, selecciona la categoria correspondiente
  </li>
</ul>
```

**Card 6: Gastos** (insertar despues de Card "Reportes de Ventas y Compras")

- Icono: `Banknote`
- Titulo: "Gastos"
- CardDescription: "Registro de gastos operativos del negocio"
- Contenido:
  - Texto intro: "Los gastos permiten registrar erogaciones del negocio que no se vinculan a una factura de compra (alquileres, servicios, viaticos, etc.)."
  - Pasos para crear:
    1. Ve a **Comercial -> Gastos**
    2. Haz clic en **Nuevo Gasto**
    3. Completa:
      - Descripcion (obligatorio)
      - Monto
      - Fecha
      - Fecha de vencimiento (opcional)
      - Categoria de gasto (obligatorio)
      - Proveedor (opcional)
      - Notas (opcional)
    4. Puedes adjuntar comprobantes (fotos, PDFs)
  - Estados:
    - `Badge variant="secondary"`: Borrador
    - `->` `Badge`: Confirmado
    - `->` `Badge variant="outline"`: Parcialmente pagado
    - `->` `Badge`: Pagado
    - Tambien: `Badge variant="destructive"`: Anulado
  - Lista de estados:
    - **Borrador**: se puede editar
    - **Confirmado**: el gasto esta registrado, pendiente de pago
    - **Parcialmente pagado**: se aplico un pago parcial via orden de pago
    - **Pagado**: el gasto fue pagado completamente
  - Texto nota: "Las **categorias de gasto** se gestionan desde el boton de configuracion en la lista de gastos. Los pagos se registran desde **Tesoreria -> Ordenes de Pago** donde puedes seleccionar gastos pendientes."

**Card 7: Puntos de Venta** (insertar despues de Card Gastos, antes del Separator)

- Icono: `Store`
- Titulo: "Puntos de Venta"
- CardDescription: "Configuracion de puntos de emision de comprobantes"
- Contenido:
  - Texto intro: "Los puntos de venta definen desde donde se emiten comprobantes de venta (facturas, notas de credito, notas de debito)."
  - Pasos para configurar:
    1. Ve a **Comercial -> Puntos de Venta**
    2. Haz clic en **Nuevo Punto de Venta**
    3. Completa:
      - Numero del punto de venta (ej: 0001)
      - Nombre descriptivo
      - Tipos de comprobante habilitados (Factura A, B, C, NC, ND)
    4. La **numeracion** de comprobantes es automatica y secuencial por tipo
  - Texto nota: "Al crear una factura de venta, debes seleccionar un punto de venta. El sistema asigna automaticamente el siguiente numero de comprobante disponible."

---

#### Fase 3: Comercial - CRM

**Archivo:** `src/modules/help/features/guide/components/_CommercialGuide.tsx`

**Imports adicionales a agregar:**
```tsx
import { Contact, UserSearch } from 'lucide-react';
```

**Card 8: CRM - Contactos** (insertar despues de Card "Puntos de Venta", antes del Separator)

- Icono: `Contact`
- Titulo: "CRM - Contactos"
- CardDescription: "Personas de contacto de tu cartera comercial"
- Contenido:
  - Texto intro: "Los contactos representan personas individuales asociadas a clientes, proveedores o leads. Permiten registrar a las personas con las que interactuas comercialmente."
  - Pasos:
    1. Ve a **Comercial -> CRM -> Contactos**
    2. Haz clic en **Nuevo Contacto**
    3. Completa:
      - Nombre y apellido (obligatorio)
      - Email
      - Telefono
      - Cargo/posicion
      - Vinculacion: puede asociarse a un cliente (contratista) o a un lead
  - Texto nota: "Los contactos se vinculan automaticamente al crear leads con persona de contacto."

**Card 9: CRM - Leads** (insertar despues de Card Contactos)

- Icono: `UserSearch`
- Titulo: "CRM - Leads (Oportunidades)"
- CardDescription: "Seguimiento de oportunidades comerciales"
- Contenido:
  - Texto intro: "Los leads representan potenciales clientes que aun no forman parte de tu cartera. Puedes hacer seguimiento de cada oportunidad hasta su conversion."
  - Pasos:
    1. Ve a **Comercial -> CRM -> Leads**
    2. Haz clic en **Nuevo Lead**
    3. Completa:
      - Nombre de la empresa/persona (obligatorio)
      - CUIT
      - Email y telefono
      - Direccion
      - Notas / observaciones
      - Contacto asociado (opcional)
  - Estados:
    - `Badge variant="secondary"`: Nuevo
    - `->` `Badge variant="outline"`: Contactado
    - `->` `Badge`: En Negociacion
    - `->` `Badge`: Convertido
    - Tambien: `Badge variant="destructive"`: Rechazado / Inactivo
  - Lista de estados:
    - **Nuevo**: lead recien registrado
    - **Contactado**: se establecio primer contacto
    - **En Negociacion**: hay una propuesta o cotizacion en curso
    - **Convertido**: el lead se convirtio en cliente (se crea automaticamente el registro de cliente)
    - **Rechazado / Inactivo**: la oportunidad no prospero
  - Texto nota: "Al convertir un lead, el sistema crea automaticamente un registro de cliente con los datos del lead."

**Card 10: CRM - Cotizaciones** (insertar despues de Card Leads)

- Icono: `FileSpreadsheet` (importar de lucide-react)
- Titulo: "CRM - Cotizaciones"
- CardDescription: "Propuestas comerciales para clientes y leads"
- Contenido:
  - Texto: "Las cotizaciones estan **proximamente disponibles**. Permitiran crear propuestas comerciales con lineas de productos, enviarlas a clientes o leads, y convertirlas en facturas al ser aceptadas."
  - Texto nota: "Esta funcionalidad se encuentra en desarrollo."

(Nota: La exploracion del codigo muestra que `quotes/` tiene un componente `_QuotesComingSoon.tsx`, por lo que la documentacion debe reflejar que esta funcionalidad esta "proximamente disponible".)

**Import adicional para Fase 3:**
```tsx
import { Contact, FileSpreadsheet, UserSearch } from 'lucide-react';
```

**Actualizar el Alert de relacion** para agregar:
- **CRM**: los leads pueden convertirse en clientes, vinculando automaticamente el historial comercial

---

#### Fase 4: Tesoreria

**Archivo:** `src/modules/help/features/guide/components/_TreasuryGuide.tsx`

**Imports actualizados (reemplazar los existentes):**
```tsx
import {
  ArrowDownUp,
  BadgeDollarSign,
  Building2,
  CheckSquare,
  Clock,
  CreditCard,
  FileCheck,
  Info,
  Landmark,
  LineChart,
  Receipt,
  TrendingUp,
  Vault,
} from 'lucide-react';
```
(Se agregan: `FileCheck`, `Vault`, `Clock`, `TrendingUp`, `LineChart`)

**Card nueva 1: Cheques** (insertar despues de Card "Ordenes de Pago", antes de Card "Conciliacion Bancaria")

- Icono: `FileCheck`
- Titulo: "Cheques"
- CardDescription: "Gestion de cheques propios y de terceros"
- Contenido:
  - Texto intro: "El sistema permite gestionar cheques propios (emitidos por tu empresa) y de terceros (recibidos de clientes). Cada cheque tiene un ciclo de vida completo con seguimiento de estado."
  - Pasos para registrar:
    1. Ve a **Tesoreria -> Cheques**
    2. Haz clic en **Nuevo Cheque**
    3. Completa:
      - Tipo: Propio o De Tercero
      - Numero de cheque
      - Banco emisor
      - Monto
      - Fecha de emision y fecha de vencimiento
      - Librador (quien emite el cheque)
      - Beneficiario (a quien se paga)
      - Cliente o proveedor asociado (segun tipo)
      - Cuenta bancaria vinculada (opcional)
  - Texto: "**Estados de cheques de terceros:**"
  - Flujo de estados (con Badges):
    - `Badge variant="secondary"`: En Cartera
    - `->` `Badge`: Depositado
    - `->` `Badge`: Acreditado
    - Tambien: `Badge variant="outline"`: Endosado | `Badge variant="destructive"`: Rechazado / Anulado
  - Lista de estados:
    - **En Cartera**: cheque recibido, disponible
    - **Depositado**: enviado al banco para su cobro
    - **Acreditado**: el banco acredito el monto
    - **Endosado**: transferido a un tercero
    - **Rechazado**: el banco rechazo el cheque
  - Texto: "**Estados de cheques propios:**"
  - Lista:
    - **Entregado**: cheque emitido y entregado al beneficiario
    - **Cobrado**: el cheque fue debitado de tu cuenta
    - **Anulado**: el cheque fue anulado
  - Texto nota: "Desde el detalle del cheque puedes realizar acciones como depositar, endosar o marcar como rechazado."

**Card nueva 2: Cajas Registradoras** (insertar despues de Card Cheques)

- Icono: `Vault`
- Titulo: "Cajas Registradoras"
- CardDescription: "Gestion de cajas para operaciones en efectivo"
- Contenido:
  - Texto intro: "Las cajas registradoras permiten gestionar el efectivo de tu negocio. Cada caja tiene sesiones de apertura y cierre con control de saldos."
  - Pasos para crear:
    1. Ve a **Tesoreria -> Cajas**
    2. Haz clic en **Nueva Caja**
    3. Completa:
      - Codigo (unico)
      - Nombre
      - Ubicacion (opcional)
      - Marcar como caja por defecto si corresponde
  - Texto nota: "Cada caja puede tener una unica sesion abierta a la vez."

**Card nueva 3: Sesiones de Caja** (insertar despues de Card Cajas Registradoras)

- Icono: `Clock`
- Titulo: "Sesiones de Caja"
- CardDescription: "Apertura, operaciones y cierre de caja"
- Contenido:
  - Texto: "**Abrir una sesion:**"
  - Pasos:
    1. En la lista de cajas, haz clic en **Abrir Sesion** en la caja deseada
    2. Indica el **monto de apertura** (efectivo inicial en caja)
    3. Agrega notas de apertura si es necesario
  - Texto: "**Durante la sesion:**"
  - Lista:
    - Se registran automaticamente los movimientos de cobros en efectivo (recibos)
    - Se registran automaticamente los pagos en efectivo (ordenes de pago)
    - El sistema calcula el **saldo esperado** en base a los movimientos
  - Texto: "**Cerrar la sesion:**"
  - Pasos:
    1. Haz clic en **Cerrar Sesion**
    2. Indica el **monto real** contado en caja (arqueo)
    3. El sistema muestra la **diferencia** entre lo esperado y lo real
    4. Agrega notas de cierre si hay observaciones

**Card nueva 4: Flujo de Caja (Cashflow)** (insertar despues de Card Sesiones)

- Icono: `TrendingUp`
- Titulo: "Flujo de Caja"
- CardDescription: "Visualizacion de ingresos y egresos"
- Contenido:
  - Texto intro: "El flujo de caja muestra una vision consolidada de todos los ingresos y egresos de tu empresa en un periodo determinado."
  - Desde **Tesoreria -> Flujo de Caja** puedes ver:
  - Lista:
    - **Resumen**: tarjetas con total de ingresos, total de egresos y saldo neto
    - **Grafico**: evolucion temporal de ingresos y egresos
    - **Tabla detallada**: cada movimiento con fecha, tipo, monto y origen
  - Texto: "Puedes cambiar la **granularidad** (diario, semanal, mensual) y filtrar por rango de fechas."

**Card nueva 5: Proyecciones de Cashflow** (insertar despues de Card Flujo de Caja)

- Icono: `LineChart`
- Titulo: "Proyecciones de Cashflow"
- CardDescription: "Planificacion financiera a futuro"
- Contenido:
  - Texto intro: "Las proyecciones permiten registrar ingresos y egresos esperados a futuro para planificar la disponibilidad de fondos."
  - Pasos para crear:
    1. Ve a **Tesoreria -> Proyecciones**
    2. Haz clic en **Nueva Proyeccion**
    3. Completa:
      - Tipo: Ingreso o Egreso
      - Categoria: Venta, Compra, Gasto, Salario, Impuesto, Otro
      - Descripcion
      - Monto esperado
      - Fecha esperada
      - Si es recurrente (opcional)
      - Notas (opcional)
  - Texto: "Cada proyeccion puede **vincularse** a documentos reales (facturas de venta, facturas de compra, gastos) a medida que se concretan, permitiendo comparar lo proyectado vs lo real."
  - Texto nota: "Las proyecciones ayudan a anticipar necesidades de financiamiento o excedentes de liquidez."

**Actualizar el Alert de relacion** de `_TreasuryGuide.tsx` para agregar:
- **Cheques**: los cheques de terceros se reciben en recibos de cobro; los cheques propios se entregan en ordenes de pago
- **Cajas**: los cobros y pagos en efectivo se registran contra la sesion de caja abierta

---

#### Fase 5: Contabilidad

**Archivo:** `src/modules/help/features/guide/components/_AccountingGuide.tsx`

**Imports actualizados (reemplazar los existentes):**
```tsx
import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Calculator,
  CalendarCheck,
  Info,
  Link2,
  Lock,
  PiggyBank,
  RefreshCcw,
  Settings,
  TrendingDown,
} from 'lucide-react';
```
(Se agregan: `PiggyBank`, `Lock`, `BookOpenCheck`, `TrendingDown`)

**Card nueva 1: Presupuestos y Control Presupuestario** (insertar despues de Card "Asientos Recurrentes")

- Icono: `PiggyBank`
- Titulo: "Presupuestos"
- CardDescription: "Control presupuestario por cuenta y periodo"
- Contenido:
  - Texto intro: "Los presupuestos permiten definir montos planificados por cuenta contable y ano fiscal, y luego comparar lo ejecutado vs lo presupuestado."
  - Pasos para crear:
    1. Ve a **Contabilidad -> Presupuestos**
    2. Haz clic en **Nuevo Presupuesto**
    3. Selecciona la **cuenta contable** a presupuestar
    4. Selecciona el **ano fiscal**
    5. Ingresa los **montos mensuales** (12 meses)
    6. Agrega notas opcionales
    7. Guarda (queda en Borrador)
  - Estados:
    - `Badge variant="secondary"`: Borrador
    - `->` `Badge`: Activo
    - `->` `Badge variant="outline"`: Cerrado
  - Lista de estados:
    - **Borrador**: se puede editar libremente los montos mensuales
    - **Activo**: el presupuesto esta vigente, se compara contra la ejecucion real
    - **Cerrado**: el presupuesto fue cerrado al finalizar el periodo
  - Texto: "**Control de ejecucion:**"
  - Lista:
    - En el detalle del presupuesto puedes ver mes a mes: **monto presupuestado**, **monto ejecutado** y **porcentaje de ejecucion**
    - Los montos ejecutados se calculan automaticamente desde los asientos contables registrados en la cuenta
  - Texto: "**Revisiones:**"
  - Lista:
    - Un presupuesto activo puede tener **revisiones** si necesitas ajustar los montos
    - Cada revision registra los nuevos montos y el motivo del ajuste
    - Se mantiene un historial completo de revisiones

**Card nueva 2: Bloqueo de Periodos Contables** (insertar despues de Card Presupuestos)

- Icono: `Lock`
- Titulo: "Bloqueo de Periodos"
- CardDescription: "Impedir modificaciones en periodos cerrados"
- Contenido:
  - Texto intro: "El bloqueo de periodos impide que se registren o modifiquen asientos contables en meses ya cerrados, protegiendo la integridad de la informacion contable."
  - Pasos:
    1. Ve a **Contabilidad -> Configuracion**
    2. En la seccion **Bloqueo de Periodos**, veras una grilla con los meses del ejercicio fiscal
    3. Cada mes muestra un icono de candado (bloqueado) o candado abierto (desbloqueado)
    4. Haz clic en el **primer mes desbloqueado** para bloquearlo
    5. Haz clic en el **ultimo mes bloqueado** para desbloquearlo
    6. Confirma la accion en el dialogo
  - Texto nota: "Al bloquear un periodo, cualquier intento de registrar un asiento con fecha dentro de ese periodo sera rechazado por el sistema. El bloqueo es progresivo: se bloquean todos los meses hasta el seleccionado."

**Card nueva 3: Saldos Iniciales / Apertura** (insertar despues de Card Bloqueo de Periodos)

- Icono: `BookOpenCheck`
- Titulo: "Saldos de Apertura"
- CardDescription: "Carga inicial de saldos contables y facturas pendientes"
- Contenido:
  - Texto intro: "Al comenzar a usar el sistema, puedes cargar los saldos iniciales de tus cuentas contables y las facturas pendientes de cobro/pago para arrancar con datos reales."
  - Texto: "La pantalla de apertura tiene tres pestanas:"
  - Lista:
    - **Saldos de Cuentas**: ingresa el debe y haber de cada cuenta contable. El sistema valida que el total del debe sea igual al total del haber
    - **Facturas de Venta Pendientes**: carga facturas de venta que aun no fueron cobradas (cliente, tipo de comprobante, numero, fecha, total)
    - **Facturas de Compra Pendientes**: carga facturas de compra que aun no fueron pagadas (proveedor, tipo de comprobante, numero, fecha, total)
  - Pasos para saldos:
    1. Ve a **Contabilidad -> Saldos de Apertura**
    2. Selecciona las cuentas y carga los montos en Debe y Haber
    3. Verifica que el total cuadre (Debe = Haber)
    4. Confirma para generar el asiento de apertura
  - Texto nota: "Las facturas de apertura se pueden cargar manualmente una por una o importar desde un archivo Excel."

**Card nueva 4: Depreciacion de Activos Fijos** (insertar despues de Card Saldos de Apertura)

- Icono: `TrendingDown`
- Titulo: "Depreciacion de Activos Fijos"
- CardDescription: "Generacion automatica de asientos de depreciacion"
- Contenido:
  - Texto intro: "El sistema genera automaticamente asientos contables de depreciacion para los equipos configurados en el modulo de Equipamiento."
  - Texto: "**Como funciona:**"
  - Lista:
    - Desde el detalle de un equipo (modulo Equipamiento), se configura la **depreciacion** con valor de origen, vida util y metodo
    - El sistema calcula el **plan de depreciacion** mes a mes
    - Desde Contabilidad, puedes **generar los asientos** de depreciacion para el periodo actual
    - Los asientos se crean automaticamente con las cuentas de depreciacion configuradas en la integracion comercial
  - Texto nota: "Los metodos de depreciacion disponibles son: **Linea recta** (cuotas iguales) y **Saldo decreciente** (cuotas decrecientes). Consulta la guia de Equipamiento para configurar la depreciacion en cada equipo."

**Actualizar el Alert de relacion** de `_AccountingGuide.tsx` para agregar:
- **Equipamiento**: la depreciacion de activos fijos genera asientos contables automaticos
- **Presupuestos**: los asientos registrados alimentan la ejecucion presupuestaria automaticamente

---

#### Fase 6: Equipamiento

**Archivo:** `src/modules/help/features/guide/components/_EquipmentGuide.tsx`

**Imports actualizados (reemplazar los existentes):**
```tsx
import { FileText, Info, Plus, QrCode, TrendingDown, Truck } from 'lucide-react';
```
(Se agrega: `TrendingDown`)

**Agregar import de Badge:**
```tsx
import { Badge } from '@/shared/components/ui/badge';
```

**Card nueva: Depreciacion de Equipos** (insertar despues de Card "Codigo QR Publico", antes del Separator)

- Icono: `TrendingDown`
- Titulo: "Depreciacion de Equipos"
- CardDescription: "Control del valor contable de tus activos"
- Contenido:
  - Texto intro: "Cada equipo puede configurarse para calcular automaticamente su depreciacion contable, reflejando la perdida de valor a lo largo del tiempo."
  - Pasos para configurar:
    1. Ve al **detalle del equipo**
    2. Selecciona la pestana **Depreciacion**
    3. Haz clic en **Configurar Depreciacion**
    4. Completa:
      - **Valor de origen** (costo de adquisicion del equipo)
      - **Valor residual** (valor estimado al final de la vida util)
      - **Vida util** (en meses, maximo 600 meses / 50 anos)
      - **Fecha de inicio** de la depreciacion
      - **Metodo de depreciacion**:
        - Linea recta: cuota fija mensual
        - Saldo decreciente: cuota decreciente (requiere indicar tasa)
  - Texto: "**Plan de depreciacion:**"
  - Lista:
    - Una vez configurado, el sistema genera el **cronograma** completo mes a mes
    - Cada linea del plan muestra: periodo, cuota de depreciacion, depreciacion acumulada y valor residual
    - Puedes ver el progreso con porcentaje de depreciacion completada
  - Estados de depreciacion:
    - `Badge`: Activo
    - `Badge variant="outline"`: Completado
    - `Badge variant="secondary"`: Suspendido
  - Texto: "**Ajustes de valor:**"
  - Lista:
    - Si el valor del equipo cambia (revaluacion, deterioro), puedes registrar un **ajuste de valor**
    - Cada ajuste requiere fecha, nuevo valor y motivo
    - El plan de depreciacion se recalcula automaticamente
  - Texto nota: "Los asientos contables de depreciacion se generan desde el modulo de **Contabilidad**. Consulta la seccion de Depreciacion de Activos Fijos en la guia de Contabilidad."

**Actualizar el Alert de relacion** de `_EquipmentGuide.tsx` para agregar:
- **Contabilidad**: la depreciacion de equipos genera asientos contables automaticos que reflejan la perdida de valor en los libros

---

#### Fase 7: Empresa

**Archivo:** `src/modules/help/features/guide/components/_CompanyGuide.tsx`

**Imports actualizados (reemplazar los existentes):**
```tsx
import {
  Building2,
  ClipboardList,
  Info,
  KeyRound,
  ScrollText,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react';
```
(Se agrega: `Building2`, `ScrollText`. Se reemplaza `Users` en el icono de Auditoria por `ScrollText` para diferenciarlo mejor)

**Modificar la Card de "Auditoria de Permisos"** para convertirla en "Auditoria del Sistema":

- Cambiar icono de `Users` a `ScrollText`
- Cambiar titulo de "Auditoria de Permisos" a "Auditoria del Sistema"
- Contenido actualizado:
  - Texto: "El sistema registra un log completo de todas las acciones administrativas realizadas por los usuarios:"
  - Lista:
    - **Acciones de roles**: creacion, modificacion, eliminacion de roles
    - **Acciones de permisos**: permisos otorgados o revocados (tanto de rol como individuales)
    - **Acciones de miembros**: invitaciones enviadas, aceptadas, canceladas o expiradas; cambios de rol; activacion/desactivacion
  - Texto: "Cada registro muestra:"
  - Lista:
    - Quien realizo la accion (usuario con nombre y foto)
    - Cuando se realizo
    - Que se modifico (modulo, tipo de accion)
    - Valores anterior y nuevo (cuando aplica)
  - Texto nota: "La auditoria se encuentra en **Empresa -> Auditoria** y permite filtrar por tipo de accion."

**Card nueva: Gestion de Empresas (Multi-empresa)** (insertar despues de Card "Catalogos", antes del Separator)

- Icono: `Building2`
- Titulo: "Gestion de Empresas"
- CardDescription: "Administra multiples empresas desde una misma cuenta"
- Contenido:
  - Texto intro: "El sistema soporta multiples empresas. Puedes crear varias empresas y alternar entre ellas. Todos los datos (empleados, facturas, contabilidad, etc.) son independientes por empresa."
  - Pasos para crear:
    1. Desde el menu superior, haz clic en el **selector de empresa**
    2. Haz clic en **Crear nueva empresa**
    3. Completa los datos:
      - Razon social (obligatorio)
      - Nombre comercial
      - CUIT
      - Condicion ante IVA
      - Direccion, ciudad, provincia, codigo postal
      - Email y telefono
      - Logo (opcional)
    4. Guarda para crear la empresa
  - Texto: "**Cambiar de empresa:**"
  - Lista:
    - Desde el menu superior, selecciona la empresa deseada
    - Todos los datos del sistema se actualizan para mostrar la informacion de la empresa seleccionada
    - Cada empresa tiene su propia configuracion, usuarios, roles y datos independientes
  - Texto nota: "Cada empresa tiene sus propios datos completamente aislados. Los usuarios y roles se gestionan por empresa."

**Actualizar el Alert de relacion** de `_CompanyGuide.tsx` para agregar:
- **Multi-empresa**: al cambiar de empresa, todos los modulos muestran los datos correspondientes a la empresa activa

---

#### Fase 8: Revision final

**Archivo:** `src/modules/help/features/guide/components/_GettingStarted.tsx`

**Verificaciones en _GettingStarted.tsx:**

1. En el **Paso 5: Configurar Modulos**, actualizar la lista para incluir menciones a funcionalidades nuevas:
   - **Comercial**: agregar mencion a "ordenes de compra, almacenes, CRM"
   - **Tesoreria**: agregar mencion a "cajas registradoras y cheques"
   - **Contabilidad**: agregar mencion a "presupuestos y saldos de apertura"

2. En el **Orden Sugerido de Configuracion**, agregar entre paso 5 (Comercial) y paso 6 (Tesoreria):
   - **Almacenes**: configurar depositos para control de stock

**Verificaciones generales:**
- [ ] Ejecutar `npm run check-types` para verificar que no haya errores TypeScript
- [ ] Ejecutar `npm run lint` para verificar que no haya errores de lint
- [ ] Verificar que todos los imports de iconos esten en uso (no imports sin usar)
- [ ] Verificar visualmente cada tab en el navegador
- [ ] Confirmar que cada guia cierra correctamente su div principal

### 3.4 Consideraciones tecnicas

**Iconos de lucide-react usados y disponibles:**

Los iconos elegidos para cada nueva Card se seleccionaron de lucide-react siguiendo el patron existente (iconos descriptivos de la funcion). Resumen de iconos nuevos necesarios por archivo:

| Archivo | Iconos nuevos a importar |
|---------|-------------------------|
| `_CommercialGuide.tsx` | `ArrowLeftRight`, `Banknote`, `ClipboardList`, `Contact`, `FileSpreadsheet`, `FolderTree`, `PackageCheck`, `Store`, `Tags`, `UserSearch`, `Warehouse` |
| `_TreasuryGuide.tsx` | `Clock`, `FileCheck`, `LineChart`, `TrendingUp`, `Vault` |
| `_AccountingGuide.tsx` | `BookOpenCheck`, `Lock`, `PiggyBank`, `TrendingDown` |
| `_EquipmentGuide.tsx` | `TrendingDown` + import de `Badge` |
| `_CompanyGuide.tsx` | `Building2`, `ScrollText` |

**Patrones a seguir estrictamente:**

1. **NO crear archivos nuevos** de componentes (excepto `.claude/rules/user-documentation.md`)
2. **Mantener el orden** de imports: primero lucide-react, luego componentes UI, luego separador
3. **Usar `className="space-y-3"`** en todos los `CardContent`
4. **Usar `className="space-y-6"`** en el div raiz de cada guia
5. **Usar variantes de Badge** consistentes:
   - `variant="secondary"`: estados iniciales/borrador
   - Sin variante (default): estados activos/confirmados
   - `variant="outline"`: estados intermedios/parciales
   - `variant="destructive"`: estados de cancelacion/rechazo/error
6. **Texto en espanol**, segunda persona informal
7. **Rutas en negrita**: `<strong>Modulo -> Seccion</strong>`
8. **Texto de nota** al final: `<p className="text-sm text-muted-foreground">`
9. Las Cards nuevas se insertan **antes** del `<Separator />` y del `<Alert>` final

**Tamano de componentes:**

Los archivos de guia son largos por naturaleza (contenido estatico), pero no contienen logica. `_CommercialGuide.tsx` actualmente tiene 322 lineas y crecera significativamente con las Fases 1-3. Esto es aceptable porque:
- Es contenido JSX estatico, no logica
- No tiene estado ni efectos
- La alternativa (dividir en sub-componentes) anade complejidad innecesaria para documentacion

Si el archivo supera las 600 lineas, se puede considerar extraer sub-secciones como componentes internos, pero no es necesario para esta implementacion.

## 4. Implementacion

### Fase 0: Regla de documentacion de usuario en CLAUDE.md y checklist
- **Estado:** Completada
- **Archivos modificados:**
  - `CLAUDE.md` - Agregada regla 10, fila en tabla de reglas criticas, item en checklist
  - `.claude/rules/user-documentation.md` - Creado con regla dedicada completa
- **Notas:** Implementado segun diseno sin desvios

### Fase 1: Módulo Comercial - Órdenes de compra, remitos y almacenes
- **Estado:** Completada
- **Archivos modificados:**
  - `src/modules/help/features/guide/components/_CommercialGuide.tsx` - Agregadas 4 Cards (OC, Remitos, Almacenes, Stock) + actualizado Alert de relaciones
- **Notas:** Implementado segun diseno sin desvios. Se agregaron los iconos ArrowLeftRight, ClipboardList, PackageCheck y Warehouse. El Alert de relaciones fue actualizado para incluir el flujo OC -> Remito -> Factura -> Orden de Pago y la generacion automatica de stock desde remitos.

### Fase 2: Módulo Comercial - Listas de precios, categorías, gastos y puntos de venta
- **Estado:** Completada
- **Archivos modificados:**
  - `src/modules/help/features/guide/components/_CommercialGuide.tsx` - Agregados imports (Banknote, Store, Tags), Card "Listas de Precios", sección "Categorías de Productos" en Card Productos, Card "Gastos", Card "Puntos de Venta"
- **Notas:** Implementado segun diseno sin desvios. Se uso `Banknote` en lugar de `Receipt` para Gastos (ya que `Receipt` estaba en uso para Cuenta Corriente). Las Cards de Gastos y Puntos de Venta se insertaron despues de Stock y Movimientos, antes del Separator y Alert final.

### Fase 3: Módulo Comercial - CRM (Contactos, Leads, Cotizaciones)
- **Estado:** Completada
- **Archivos modificados:**
  - `src/modules/help/features/guide/components/_CommercialGuide.tsx` - Agregados imports (Contact, FileSpreadsheet, UserSearch), Card "CRM - Contactos", Card "CRM - Leads (Oportunidades)" con estados, Card "CRM - Cotizaciones" (próximamente disponible), actualizado Alert de relaciones con mención de CRM
- **Notas:** Implementado según diseño sin desvíos. La Card de Cotizaciones refleja que la funcionalidad está en desarrollo (consistente con `_QuotesComingSoon.tsx` existente). Los estados del Lead incluyen flujo Nuevo → Contactado → En Negociación → Convertido y también Rechazado/Inactivo.

### Fase 4: Módulo Tesorería - Cheques, Cajas, Cashflow y Proyecciones
- **Estado:** Completada
- **Archivos modificados:**
  - `src/modules/help/features/guide/components/_TreasuryGuide.tsx` - Agregados imports (Clock, FileCheck, LineChart, TrendingUp, Vault), Card "Cheques" con estados de terceros (En Cartera → Depositado → Acreditado + Endosado/Rechazado/Anulado) y propios (Entregado, Cobrado, Anulado), Card "Cajas Registradoras", Card "Sesiones de Caja" con apertura/operaciones/cierre, Card "Flujo de Caja" con resumen/gráfico/tabla, Card "Proyecciones de Cashflow" con creación y vinculación a documentos reales, actualizado Alert de relaciones con mención de cheques y cajas
- **Notas:** Implementado según diseño sin desvíos. La Card de Cheques se insertó después de Órdenes de Pago y antes de Conciliación Bancaria, según lo especificado en el plan. Las Cards de Cajas, Sesiones, Flujo de Caja y Proyecciones se insertaron después de Conciliación Bancaria, antes del Separator y Alert final.

### Fase 5: Módulo Contabilidad - Presupuestos, Períodos, Apertura, Depreciación
- **Estado:** Completada
- **Archivos modificados:**
  - `src/modules/help/features/guide/components/_AccountingGuide.tsx` - Agregados imports (PiggyBank, Lock, BookOpenCheck, TrendingDown), Card "Presupuestos" con 3 estados (Borrador→Activo→Cerrado) y control de ejecución y revisiones, Card "Bloqueo de Períodos" con pasos para bloquear/desbloquear y nota sobre bloqueo progresivo, Card "Saldos de Apertura" con 3 pestañas e importación Excel, Card "Depreciación de Activos Fijos" con métodos y vinculación a Equipamiento, actualizado Alert de relaciones con mención de Equipamiento y Presupuestos
- **Notas:** Implementado según diseño sin desvíos. Las 4 Cards se insertaron después de "Asientos Recurrentes" y antes del Separator/Alert final. Se agregó import de Badge que ya existía en el archivo.

### Fase 6: Módulo Equipamiento - Depreciación de Equipos
- **Estado:** Completada
- **Archivos modificados:**
  - `src/modules/help/features/guide/components/_EquipmentGuide.tsx` - Agregados imports (TrendingDown, Badge), Card "Depreciación de Equipos" con configuración paso a paso, plan de depreciación, estados (Activo/Completado/Suspendido), ajustes de valor, y nota sobre vinculación con Contabilidad. Actualizado Alert de relaciones con mención de Contabilidad
- **Notas:** Implementado según diseño sin desvíos. La Card se insertó después de "Código QR Público" y antes del Separator/Alert final. Se usó terminología coherente con la Fase 5 (Contabilidad).

### Fase 7: Módulo Empresa - Auditoría del Sistema y Gestión Multi-empresa
- **Estado:** Completada
- **Archivos modificados:**
  - `src/modules/help/features/guide/components/_CompanyGuide.tsx` - Actualizados imports (Building2, ScrollText reemplazan Users), Card "Auditoría de Permisos" ampliada a "Auditoría del Sistema" con icono ScrollText y contenido expandido (acciones de roles, permisos y miembros + detalle de cada registro), Card "Gestión de Empresas" nueva con icono Building2 (crear empresa, datos, cambiar entre empresas), Alert actualizado con relación Multi-empresa
- **Notas:** Implementado según diseño sin desvíos. Se removió el import de `Users` (ya no se usa tras cambiar el icono de Auditoría a ScrollText).

### Fase 8: Revisión final y actualización de Primeros Pasos
- **Estado:** Completada
- **Archivos modificados:**
  - `src/modules/help/features/guide/components/_GettingStarted.tsx` - Actualizado Paso 5 (Configurar Módulos) con menciones a almacenes, CRM, cajas, cheques, presupuestos y saldos de apertura. Actualizado Orden Sugerido de Configuración agregando Almacenes entre Comercial y Tesorería, y ampliando Tesorería y Contabilidad
- **Notas:** Los errores de `check-types` son preexistentes del módulo de depreciación (no relacionados con documentación). Lint pasa sin errores en archivos de guía. La revisión visual queda pendiente para el usuario.

## 5. Verificacion

### 5.1 Revisión de código
- **Resultado:** OK
- **Observaciones:**
  - **_CommercialGuide.tsx** (1006 líneas): 16 Cards, todos los imports usados (16 iconos), estructura div > Cards > Separator > Alert correcta, todos los CardHeader con icono h-5 w-5, todos los CardContent con space-y-3, Alert final con Info h-4 w-4.
  - **_TreasuryGuide.tsx** (593 líneas): 11 Cards, todos los imports usados (11 iconos), estructura correcta, Alert con Info h-4 w-4.
  - **_AccountingGuide.tsx** (645 líneas): 12 Cards, todos los imports usados (12 iconos), estructura correcta, Alert con Info h-4 w-4.
  - **_EquipmentGuide.tsx** (290 líneas): 5 Cards, todos los imports usados (6 iconos), import de Badge agregado para estados de depreciación, estructura correcta, Alert con Info h-4 w-4.
  - **_CompanyGuide.tsx** (384 líneas): 7 Cards, todos los imports usados (7 iconos), estructura correcta, Alert con Info h-4 w-4.
  - **_GettingStarted.tsx** (286 líneas): 6 Cards (5 pasos + orden sugerido), todos los imports usados (6 iconos), estructura correcta. Nota menor: el Alert final no tiene icono Info (pre-existente, no es un cambio de esta implementación).
  - No se encontraron imports sin usar en ninguno de los 6 archivos verificados.
  - Las warnings de lint existentes (`Package` y `TrendingUp` sin usar en `_DashboardGuide.tsx`, `Package` sin usar en `_HelpGuideTabs.tsx`) son preexistentes y NO corresponden a archivos modificados en esta implementación.

### 5.2 Build / Lint
- **Resultado:** OK
- **Detalle:**
  - `npx eslint "src/modules/help/features/guide/components/*.tsx"`: 0 errores, 3 warnings (todos preexistentes en archivos no modificados: `_DashboardGuide.tsx` y `_HelpGuideTabs.tsx`).
  - `npx tsc --noEmit | grep help/features/guide`: 0 errores TypeScript en archivos de guía.
  - Los 6 archivos modificados pasan lint y check-types sin ningún problema.

### 5.3 Tests
- **Tests ejecutados:** N/A (contenido estático JSX, sin lógica)
- **Detalle:** Los archivos de guía son componentes de presentación pura con contenido estático hardcodeado en JSX. No contienen lógica de negocio, state management, ni data fetching. No se requieren tests unitarios ni E2E para este tipo de contenido.

### 5.4 Verificación funcional
- **Resultado:** Pendiente de verificación visual por el usuario
- **Detalle:** La verificación funcional consiste en navegar cada tab de la guía en `/dashboard/help` y confirmar que el contenido renderiza correctamente. Esto requiere levantar el servidor de desarrollo (`npm run dev`) y navegar manualmente. El contenido JSX es válido según TypeScript y ESLint.

### 5.5 Cumplimiento de reglas
- **CLAUDE.md respetado:** Sí
- **Observaciones:**
  - Regla 10 "Documentación de Usuario con Cada Cambio" presente en CLAUDE.md con código de ejemplo y descripción.
  - Item de checklist "Guía de usuario actualizada si hay cambios visibles para el usuario" presente.
  - Fila "Doc. Usuario" en tabla de reglas críticas con referencia a `.claude/rules/user-documentation.md`.
  - Archivo `.claude/rules/user-documentation.md` creado con las 5 secciones requeridas (Cuándo actualizar, Qué archivo modificar, Patrón JSX, Lenguaje, Imports).
  - Todos los componentes client tienen prefijo `_` en nombre.
  - No se crearon archivos en `app/`.
  - No se usa `console.*` ni `date-fns`.
  - No hay `:any` en tipos.
  - Estructura de módulo respetada (`modules/help/features/guide/components/`).

### 5.6 Resultado final
- **Estado:** APROBADO
- **Acciones pendientes:**
  - Verificación visual en navegador (requiere `npm run dev` + navegar a `/dashboard/help`).
  - Opcionalmente, limpiar las warnings preexistentes en `_DashboardGuide.tsx` (imports `Package` y `TrendingUp` sin usar) y `_HelpGuideTabs.tsx` (import `Package` sin usar), que no son parte de esta implementación pero fueron detectadas durante la verificación.
