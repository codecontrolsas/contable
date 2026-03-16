# Remitos de Entrega (COD-314)

**Fecha de inicio:** 2026-03-16
**Estado:** Planificacion completada
**Tarea Linear:** COD-314

---

## 1. Analisis

### 1.1 Problema

El sistema actualmente cuenta con remitos de recepcion (ReceivingNote) para registrar la entrada de mercaderia de proveedores, pero carece de remitos de entrega para registrar la salida de mercaderia hacia clientes. El flujo de negocio de venta con entrega de materiales requiere:

- El vendedor crea un remito de entrega para enviar materiales a un cliente. Al crear el remito, se descuenta stock del almacen seleccionado (el material debe estar disponible).
- Mientras el remito esta en estado "Pendiente de Entrega", puede ser editado (por ejemplo, si el cliente rechaza un producto en el momento de la entrega, se puede ajustar la cantidad o quitar lineas).
- Cuando el cliente acepta la mercaderia, el remito pasa a estado "Aceptado".
- Multiples remitos "Aceptados" del mismo cliente pueden facturarse juntos, generando una Factura de Venta en borrador con las lineas combinadas. Los remitos pasan a estado "Facturado".

Este flujo es el espejo del proceso de compras (OC -> Remito de Recepcion -> Factura de Compra), pero aplicado al ciclo de ventas (Remito de Entrega -> Factura de Venta).

### 1.2 Contexto actual

#### Modelos Prisma relevantes

**ReceivingNote** (`prisma/schema.prisma:3098`): Modelo existente para remitos de recepcion de compras. Sigue el flujo DRAFT -> CONFIRMED -> CANCELLED. Tiene numeracion secuencial (RR-00001), relacion con proveedor, almacen, OC y factura de compra. Incluye lineas con producto, descripcion, cantidad y referencia a linea de OC. Este modelo es la referencia directa para el nuevo DeliveryNote.

**ReceivingNoteStatus** (`prisma/schema.prisma:2180`): Enum con valores DRAFT, CONFIRMED, CANCELLED. El nuevo DeliveryNoteStatus tendra un flujo diferente: PENDING_DELIVERY, ACCEPTED, INVOICED, CANCELLED.

**StockMovement** (`prisma/schema.prisma`): Registra movimientos de stock con tipo (`StockMovementType`). El tipo `SALE` esta disponible y es el adecuado para los remitos de entrega. El tipo `ADJUSTMENT` se usa para reversiones (cancelaciones).

**WarehouseStock**: Controla stock actual por almacen y producto. Campos `quantity`, `reservedQty`, `availableQty`. La creacion de un remito de entrega debe decrementar `quantity` y `availableQty`.

**SalesInvoice** (`prisma/schema.prisma:2281`): Factura de venta existente con estado DRAFT, relacion con cliente (Contractor), punto de venta, lineas, CAE de AFIP, etc. Actualmente NO tiene relacion con remitos de entrega. Se debe agregar una relacion opcional para vincular facturas con remitos facturados.

**Product**: Productos con campo `trackStock` (boolean) que determina si se controla stock. Solo los productos con `trackStock: true` generan movimientos de stock.

#### Modulos existentes relacionados

- **Remitos de Recepcion** (`src/modules/commercial/features/purchases/features/receiving-notes/`): Sirve como template directo de implementacion. Tiene list, detail, create, edit con el patron completo de Server Component + Client DataTable + actions.server.ts + validators.
- **Facturas de Venta** (`src/modules/commercial/features/sales/features/invoices/`): El modulo destino donde se crearan las facturas desde remitos de entrega.
- **Stock** (`src/modules/commercial/features/stock/`): Logica de movimientos y control de stock.

#### Modelo DeliveryNote NO existe aun

No existe ningun modelo, enum, ruta ni componente relacionado con remitos de entrega. Todo se debe crear desde cero.

### 1.3 Modelo de datos requerido

#### Nuevo enum: DeliveryNoteStatus

```prisma
enum DeliveryNoteStatus {
  PENDING_DELIVERY    // Creado, stock descontado, pendiente de aceptacion del cliente
  ACCEPTED            // Cliente acepto la mercaderia
  INVOICED            // Facturado (vinculado a SalesInvoice)
  CANCELLED           // Anulado, stock revertido

  @@map("delivery_note_status")
}
```

**Flujo de estados:**
```
PENDING_DELIVERY ──(acceptDeliveryNote)──> ACCEPTED ──(invoiceDeliveryNotes)──> INVOICED
       │                                       │
       │ (updateDeliveryNote)                   │
       │ (deleteDeliveryNote)                   │
       │                                        │
       └──(cancelDeliveryNote)──> CANCELLED <───┘
```

#### Nuevo modelo: DeliveryNote

```prisma
model DeliveryNote {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId         String              @map("company_id") @db.Uuid
  customerId        String              @map("customer_id") @db.Uuid
  warehouseId       String              @map("warehouse_id") @db.Uuid

  // Numeracion secuencial
  number            Int
  fullNumber        String              @map("full_number") // RE-00001

  // Fechas
  deliveryDate      DateTime            @map("delivery_date") @db.Date

  // Observaciones
  notes             String?             @db.Text

  // Estado
  status            DeliveryNoteStatus  @default(PENDING_DELIVERY)

  // Referencia a factura de venta (cuando se factura)
  salesInvoiceId    String?             @map("sales_invoice_id") @db.Uuid

  // Relaciones
  company           Company             @relation(fields: [companyId], references: [id])
  customer          Contractor          @relation(fields: [customerId], references: [id])
  warehouse         Warehouse           @relation(fields: [warehouseId], references: [id])
  salesInvoice      SalesInvoice?       @relation(fields: [salesInvoiceId], references: [id])
  lines             DeliveryNoteLine[]

  createdBy         String              @map("created_by")
  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")

  @@unique([companyId, number])
  @@index([companyId, status])
  @@index([customerId])
  @@index([salesInvoiceId])
  @@map("delivery_notes")
}
```

#### Nuevo modelo: DeliveryNoteLine

```prisma
model DeliveryNoteLine {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  deliveryNoteId    String              @map("delivery_note_id") @db.Uuid
  productId         String              @map("product_id") @db.Uuid

  description       String
  quantity          Decimal             @db.Decimal(12, 3)

  // Observaciones de la linea
  notes             String?             @db.Text

  deliveryNote      DeliveryNote        @relation(fields: [deliveryNoteId], references: [id], onDelete: Cascade)
  product           Product             @relation(fields: [productId], references: [id])

  @@map("delivery_note_lines")
}
```

#### Modificaciones a modelos existentes

- **SalesInvoice**: Agregar relacion `deliveryNotes DeliveryNote[]` para vincular facturas con remitos facturados.
- **Company**: Agregar relacion `deliveryNotes DeliveryNote[]`.
- **Contractor**: Agregar relacion `deliveryNotes DeliveryNote[]` (ya tiene relacion con SalesInvoice como customer).
- **Warehouse**: Agregar relacion `deliveryNotes DeliveryNote[]`.
- **Product**: Agregar relacion `deliveryNoteLines DeliveryNoteLine[]`.

### 1.4 Dependencias

#### Librerias existentes (no se necesitan nuevas)

- **Prisma ORM 7**: Para los nuevos modelos. Ya disponible.
- **Zod**: Para validacion de formularios. Ya disponible.
- **React Hook Form**: Para formularios de creacion/edicion. Ya disponible.
- **React Query (TanStack Query v5)**: Para fetching en componentes client. Ya disponible.
- **moment.js**: Para manejo de fechas. Ya disponible.
- **shadcn/ui**: Para componentes de UI. Ya disponible.
- **Sonner**: Para notificaciones toast. Ya disponible.
- **Lucide React**: Para iconos. Ya disponible.

No se requiere instalar ninguna libreria nueva.

#### Modulos internos de los que depende

- `src/modules/commercial/features/purchases/features/receiving-notes/`: Patron de implementacion completo (template directo).
- `src/modules/commercial/features/sales/features/invoices/`: Modulo de facturas de venta para la integracion de facturacion desde remitos.
- `src/shared/lib/company.ts`: `getActiveCompanyId()` para server actions.
- `src/shared/lib/prisma.ts`: Cliente Prisma singleton.
- `src/shared/lib/logger.ts`: Logger para registrar operaciones.
- `src/shared/lib/permissions/`: Sistema RBAC para checkPermission.
- `src/shared/components/common/DataTable`: Componente de tabla con paginacion server-side.

### 1.5 Restricciones y reglas

#### Reglas del CLAUDE.md que aplican directamente

1. **Server Components por defecto**: `DeliveryNotesList.tsx`, `DeliveryNoteDetail.tsx`, `CreateDeliveryNote.tsx`, `EditDeliveryNote.tsx` seran Server Components. Los componentes interactivos (`_DeliveryNotesTable.tsx`, `_DeliveryNoteForm.tsx`, `_DeliveryNoteActions.tsx`) seran Client Components con prefijo `_`.

2. **Server Actions en el modulo**: Todas las actions van en `src/modules/commercial/features/sales/features/delivery-notes/list/actions.server.ts`, no en carpetas separadas.

3. **No importar entre modulos**: La feature de delivery notes vive dentro del modulo `commercial/features/sales/features/`. La integracion con SalesInvoice es dentro del mismo modulo, no entre modulos.

4. **Decimal a Number()**: Los campos `quantity` de DeliveryNoteLine (Decimal 12,3) deben convertirse con `Number()` antes de pasar a Client Components.

5. **useQuery para fetching**: Los componentes client usaran `useQuery` para obtener datos.

6. **Zod para validacion**: Schemas en `shared/validators.ts` del feature.

7. **DataTable con meta.title**: Todas las columnas de la tabla deben tener `meta: { title: '...' }`.

8. **AlertDialog, nunca confirm()**: Para confirmaciones de aceptar, cancelar o eliminar.

9. **moment.js, nunca date-fns**: Para manejo de fechas de entrega.

10. **Logger, nunca console.***: Todas las operaciones de server actions usan `logger`.

11. **Tests E2E obligatorios**: Crear spec en `cypress/e2e/commercial/delivery-notes.cy.ts`.

12. **Documentacion**: Actualizar `docs/modules/commercial.md` y `docs/architecture/data-model.md`.

13. **Permisos obligatorios**: `checkPermission` en actions, `PermissionGuard` en pages, `hasPermission` en client.

#### Restricciones tecnicas

- **Stock se descuenta al CREAR** (no al confirmar como en receiving notes): Esto significa que la creacion debe validar stock suficiente y descontar en la misma transaccion. Es diferente al patron de receiving notes donde el stock se suma al confirmar.
- **Edicion requiere reversion de stock**: Al editar un remito PENDING_DELIVERY, se debe revertir el stock de las lineas anteriores y descontar el stock de las nuevas lineas, todo en una sola transaccion.
- **Cancelacion desde PENDING_DELIVERY o ACCEPTED**: Ambos estados permiten cancelacion con reversion de stock. Solo INVOICED no permite cancelar (el remito ya esta vinculado a una factura).
- **Eliminacion solo PENDING_DELIVERY**: Eliminar un remito revierte el stock y borra el registro.
- **Facturacion multi-remito**: Multiples remitos ACCEPTED del mismo cliente se pueden facturar juntos en una sola SalesInvoice DRAFT. Esto requiere validar que todos los remitos seleccionados sean del mismo cliente.

### 1.6 Riesgos identificados

1. **Stock al crear vs al confirmar**: A diferencia de los remitos de recepcion (que suman stock al confirmar), los remitos de entrega descuentan stock al crear. Esto significa que si la creacion falla despues de descontar stock, hay riesgo de inconsistencia. Mitigacion: toda la logica de creacion + descuento de stock debe estar en una unica transaccion `$transaction`.

2. **Edicion con reversion de stock**: Editar un remito en PENDING_DELIVERY requiere revertir el stock de las lineas anteriores y descontar las nuevas. Si los productos o cantidades cambian entre la version anterior y la nueva, la logica de reversion es delicada. Mitigacion: eliminar todas las lineas anteriores y crear las nuevas dentro de la misma transaccion, revirtiendo y descontando stock atomicamente.

3. **Race condition en stock**: Dos usuarios podrian intentar crear remitos de entrega para el mismo producto al mismo tiempo, excediendo el stock disponible. Mitigacion: la verificacion de stock y el descuento deben estar en la misma transaccion con nivel de aislamiento adecuado.

4. **Facturacion multi-remito**: Al facturar multiples remitos, se debe crear una SalesInvoice DRAFT con las lineas combinadas. La complejidad esta en mapear las lineas de DeliveryNote (que no tienen precio) a lineas de SalesInvoice (que requieren precio unitario, IVA, etc.). Mitigacion: la factura se crea como DRAFT sin precios, el usuario debe completar los precios manualmente antes de confirmar.

5. **Estado INVOICED acoplado a SalesInvoice**: Si una SalesInvoice vinculada se cancela, los remitos deberian volver a ACCEPTED. Esto crea un acoplamiento bidireccional. Mitigacion: para la primera iteracion, no manejar este caso automaticamente; si se cancela la factura, los remitos quedan en INVOICED y el usuario debe gestionar manualmente. Se puede agregar en una iteracion futura.

6. **Numeracion secuencial RE-xxxxx**: La generacion del numero secuencial debe ser atomica para evitar duplicados. Mitigacion: usar la misma logica de `findFirst + orderBy desc` dentro de la transaccion de creacion.

---

## 2. Planificacion

### 2.1 Fases de implementacion

#### Fase 1: Modelo de datos y permisos
- **Objetivo:** Crear los modelos Prisma `DeliveryNote` y `DeliveryNoteLine` con sus relaciones, enum `DeliveryNoteStatus`, registrar el modulo en el sistema de permisos, y ejecutar la migracion.
- **Tareas:**
  - [ ] Agregar enum `DeliveryNoteStatus` en `prisma/schema.prisma` con valores: `PENDING_DELIVERY`, `ACCEPTED`, `INVOICED`, `CANCELLED`. Ubicar junto al enum `ReceivingNoteStatus` (despues de linea ~2186).
  - [ ] Crear modelo `DeliveryNote` en `prisma/schema.prisma` con campos: `id` (UUID), `companyId` (UUID, FK a Company), `customerId` (UUID, FK a Contractor), `warehouseId` (UUID, FK a Warehouse), `number` (Int), `fullNumber` (String, formato RE-00001), `deliveryDate` (DateTime @db.Date), `notes` (String? @db.Text), `status` (DeliveryNoteStatus, default PENDING_DELIVERY), `salesInvoiceId` (String? UUID, FK a SalesInvoice), `createdBy` (String), `createdAt`, `updatedAt`. Constraints: `@@unique([companyId, number])`, `@@index([companyId, status])`, `@@index([customerId])`, `@@index([salesInvoiceId])`. Mapa: `@@map("delivery_notes")`. Ubicar despues de ReceivingNoteLine (linea ~3159).
  - [ ] Crear modelo `DeliveryNoteLine` en `prisma/schema.prisma` con campos: `id` (UUID), `deliveryNoteId` (UUID, FK a DeliveryNote con onDelete Cascade), `productId` (UUID, FK a Product), `description` (String), `quantity` (Decimal 12,3), `notes` (String? @db.Text). Mapa: `@@map("delivery_note_lines")`.
  - [ ] Agregar relacion `deliveryNotes DeliveryNote[]` en modelo `SalesInvoice` (despues de linea ~2335).
  - [ ] Agregar relacion `deliveryNotes DeliveryNote[]` en modelo `Company`.
  - [ ] Agregar relacion `deliveryNotes DeliveryNote[]` en modelo `Contractor` (el customer).
  - [ ] Agregar relacion `deliveryNotes DeliveryNote[]` en modelo `Warehouse`.
  - [ ] Agregar relacion `deliveryNoteLines DeliveryNoteLine[]` en modelo `Product`.
  - [ ] Agregar `'commercial.delivery-notes': 'commercial.delivery-notes'` en el objeto `MODULES` de `src/shared/lib/permissions/constants.ts` (despues de `'commercial.receiving-notes'`, linea ~38).
  - [ ] Agregar `'commercial.delivery-notes': 'Remitos de Entrega'` en `MODULE_LABELS` (despues de `'commercial.receiving-notes'`, linea ~127).
  - [ ] Agregar `'commercial.delivery-notes'` al array `modules` del grupo `comercial` en `MODULE_GROUPS` (despues de `'commercial.receiving-notes'`, linea ~205).
  - [ ] Ejecutar `npm run db:migrate` para crear la migracion `add_delivery_note_models`.
  - [ ] Ejecutar `npm run db:generate` para regenerar el cliente Prisma.
- **Archivos:**
  - Modificar: `prisma/schema.prisma`, `src/shared/lib/permissions/constants.ts`
- **Criterio de completitud:** Los modelos DeliveryNote y DeliveryNoteLine existen en la BD, `npm run db:generate` pasa sin errores, los tipos `DeliveryNote`, `DeliveryNoteLine`, `DeliveryNoteStatus` estan disponibles en `@/generated/prisma`, y el modulo `commercial.delivery-notes` esta registrado en permisos con su label y grupo.

#### Fase 2: Validators y tipos
- **Objetivo:** Crear los schemas Zod de validacion, las constantes de labels/badges para status, y los tipos necesarios.
- **Tareas:**
  - [ ] Crear directorio `src/modules/commercial/features/sales/features/delivery-notes/`.
  - [ ] Crear subdirectorio `shared/`.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/shared/validators.ts` con:
    - Constantes `DELIVERY_NOTE_STATUS_LABELS` (Record<DeliveryNoteStatus, string>): `PENDING_DELIVERY: 'Pendiente de Entrega'`, `ACCEPTED: 'Aceptado'`, `INVOICED: 'Facturado'`, `CANCELLED: 'Anulado'`.
    - Constantes `DELIVERY_NOTE_STATUS_VARIANTS` (Record<DeliveryNoteStatus, variant>): `PENDING_DELIVERY: 'secondary'`, `ACCEPTED: 'default'`, `INVOICED: 'outline'`, `CANCELLED: 'destructive'`.
    - Schema `deliveryNoteLineSchema`: `productId` (string UUID), `description` (string min 1), `quantity` (string regex decimal, > 0), `notes` (string optional nullable).
    - Schema `deliveryNoteFormSchema`: `customerId` (string UUID), `warehouseId` (string UUID), `deliveryDate` (date required), `notes` (string optional nullable), `lines` (array min 1 de deliveryNoteLineSchema).
    - Tipos inferidos: `DeliveryNoteFormInput`, `DeliveryNoteLineInput`.
- **Archivos:**
  - Crear: `src/modules/commercial/features/sales/features/delivery-notes/shared/validators.ts`
- **Criterio de completitud:** Los schemas Zod compilan sin errores, las constantes de labels y variants estan definidas, los tipos inferidos son exportados.

#### Fase 3: Server Actions - CRUD
- **Objetivo:** Implementar toda la logica de negocio: crear, listar, obtener detalle, actualizar, eliminar, aceptar, cancelar remitos de entrega, con manejo de stock.
- **Tareas:**
  - [ ] Crear directorio `src/modules/commercial/features/sales/features/delivery-notes/list/`.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/list/actions.server.ts` con las siguientes funciones:

    **Queries:**
    - `getDeliveryNotesPaginated(searchParams: DataTableSearchParams)`: Listado paginado con busqueda en fullNumber y notes, filtros facetados por status, filtros de rango de fecha en deliveryDate. Include customer (businessName, tradeName, taxId), warehouse (name), salesInvoice (fullNumber). OrderBy deliveryDate desc. CheckPermission `commercial.delivery-notes` `view`.
    - `getDeliveryNoteById(id: string)`: Detalle completo con customer, warehouse, salesInvoice, lines (con product: code, name, unitOfMeasure, trackStock). Convertir quantity con Number(). CheckPermission `commercial.delivery-notes` `view`.
    - `getCustomersForSelect()`: Clientes activos (Contractor con tipo CLIENT) con id, businessName, tradeName, taxId. OrderBy businessName.
    - `getWarehousesForSelect()`: Almacenes activos con id, name, type. OrderBy name.
    - `getProductsForSelect()`: Productos activos con trackStock true. Select: id, code, name, unitOfMeasure. OrderBy name.
    - `getDeliveryNoteFacetCounts()`: Conteos por status con groupBy para filtros facetados.

    **Mutations:**
    - `createDeliveryNote(input: DeliveryNoteFormInput)`: En una sola transaccion: generar numero secuencial (RE-xxxxx), verificar stock suficiente para cada linea con trackStock, crear el remito con status PENDING_DELIVERY, crear movimientos de stock tipo SALE (cantidad negativa para descontar), decrementar warehouseStock.quantity y availableQty. CheckPermission `commercial.delivery-notes` `create`.
    - `updateDeliveryNote(id: string, input: DeliveryNoteFormInput)`: Solo si status es PENDING_DELIVERY. En transaccion: revertir stock de lineas anteriores (crear movimientos ADJUSTMENT positivos, incrementar warehouseStock), eliminar lineas anteriores, verificar stock para nuevas lineas, crear nuevas lineas, crear movimientos SALE negativos, decrementar warehouseStock. CheckPermission `commercial.delivery-notes` `update`.
    - `deleteDeliveryNote(id: string)`: Solo si status es PENDING_DELIVERY. Revertir stock (movimientos ADJUSTMENT positivos, incrementar warehouseStock), eliminar el remito (cascade elimina lineas). CheckPermission `commercial.delivery-notes` `delete`.
    - `acceptDeliveryNote(id: string)`: Solo si status es PENDING_DELIVERY. Cambiar status a ACCEPTED. No hay cambio de stock (ya fue descontado al crear). CheckPermission `commercial.delivery-notes` `approve`.
    - `cancelDeliveryNote(id: string)`: Solo si status es PENDING_DELIVERY o ACCEPTED. Verificar stock suficiente para revertir, crear movimientos ADJUSTMENT positivos, incrementar warehouseStock, cambiar status a CANCELLED. CheckPermission `commercial.delivery-notes` `delete`.

    **Tipos inferidos:**
    - `DeliveryNoteListItem`: Tipo del item de la lista.
    - `DeliveryNoteDetail`: Tipo del detalle completo.
    - `CustomerSelectItem`: Tipo del item de select de clientes.
    - `WarehouseSelectItem`: Tipo del item de select de almacenes.
- **Archivos:**
  - Crear: `src/modules/commercial/features/sales/features/delivery-notes/list/actions.server.ts`
- **Criterio de completitud:** Todas las funciones existen, compilan sin errores, usan `getActiveCompanyId()`, `logger`, `auth()`, `checkPermission()`, convierten Decimal a Number(), y manejan stock correctamente en transacciones.

#### Fase 4: UI - Listado
- **Objetivo:** Implementar la pagina principal con la tabla de remitos de entrega, la ruta de la app, y la entrada en el sidebar.
- **Tareas:**
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/list/DeliveryNotesList.tsx` (Server Component): Obtener datos iniciales, renderizar con PermissionGuard `commercial.delivery-notes` `view` redirect, boton "Nuevo Remito" con PermissionGuard `commercial.delivery-notes` `create`.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/list/components/_DeliveryNotesTable.tsx` (Client Component): DataTable con paginacion server-side. Columnas: Numero (fullNumber), Cliente (businessName o tradeName), Almacen, Fecha de Entrega, Estado (Badge), Acciones. Todas las columnas con `meta: { title: '...' }`. Filtro facetado por status. Busqueda por numero y notas. Click en fila navega a detalle.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/list/columns.tsx`: Definicion de columnas con columnHelper, incluyendo status con Badge y variants.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/list/index.ts`: Barrel export.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/index.ts`: Barrel export del modulo.
  - [ ] Crear directorio y archivo `src/app/(core)/dashboard/commercial/delivery-notes/page.tsx`: Pagina thin que importa DeliveryNotesList.
  - [ ] Agregar item de navegacion en el sidebar (`src/shared/components/layout/_AppSidebar.tsx`): `{ title: 'Remitos de Entrega', href: '/dashboard/commercial/delivery-notes', module: 'commercial.delivery-notes' }`. Ubicar en la seccion de Ventas, despues de Facturas de Venta o junto a los remitos de recepcion.
- **Archivos:**
  - Crear: `src/modules/commercial/features/sales/features/delivery-notes/list/DeliveryNotesList.tsx`, `src/modules/commercial/features/sales/features/delivery-notes/list/components/_DeliveryNotesTable.tsx`, `src/modules/commercial/features/sales/features/delivery-notes/list/columns.tsx`, `src/modules/commercial/features/sales/features/delivery-notes/list/index.ts`, `src/modules/commercial/features/sales/features/delivery-notes/index.ts`, `src/app/(core)/dashboard/commercial/delivery-notes/page.tsx`
  - Modificar: `src/shared/components/layout/_AppSidebar.tsx`
- **Criterio de completitud:** La ruta `/dashboard/commercial/delivery-notes` existe, el item aparece en el sidebar, la tabla muestra remitos con filtros de status y busqueda, paginacion funciona correctamente.

#### Fase 5: UI - Crear y Editar
- **Objetivo:** Implementar los formularios de creacion y edicion de remitos de entrega con validacion de stock.
- **Tareas:**
  - [ ] Crear directorio `src/modules/commercial/features/sales/features/delivery-notes/create/`.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/create/CreateDeliveryNote.tsx` (Server Component): Obtener datos iniciales (clientes, almacenes, productos), renderizar con PermissionGuard `commercial.delivery-notes` `create` redirect.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/create/components/_DeliveryNoteForm.tsx` (Client Component): Formulario React Hook Form + Zod con:
    - Select de cliente (Combobox con busqueda).
    - Select de almacen.
    - DatePicker para fecha de entrega.
    - Campo de notas (opcional).
    - Tabla de lineas dinamica: agregar/quitar lineas, cada linea con select de producto (Combobox), descripcion (autocompletada desde producto), cantidad, notas. Boton "Agregar Linea".
    - Botones: Cancelar (vuelve al listado) + Guardar.
    - UseMutation para submit con redireccion al detalle o listado.
  - [ ] Crear directorio `src/modules/commercial/features/sales/features/delivery-notes/edit/`.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/edit/EditDeliveryNote.tsx` (Server Component): Obtener remito existente por ID, verificar que esta en PENDING_DELIVERY, renderizar formulario con datos precargados.
  - [ ] Crear `src/app/(core)/dashboard/commercial/delivery-notes/new/page.tsx`: Pagina thin para crear.
  - [ ] Crear `src/app/(core)/dashboard/commercial/delivery-notes/[id]/edit/page.tsx`: Pagina thin para editar.
- **Archivos:**
  - Crear: `src/modules/commercial/features/sales/features/delivery-notes/create/CreateDeliveryNote.tsx`, `src/modules/commercial/features/sales/features/delivery-notes/create/components/_DeliveryNoteForm.tsx`, `src/modules/commercial/features/sales/features/delivery-notes/edit/EditDeliveryNote.tsx`, `src/app/(core)/dashboard/commercial/delivery-notes/new/page.tsx`, `src/app/(core)/dashboard/commercial/delivery-notes/[id]/edit/page.tsx`
- **Criterio de completitud:** Se puede crear un remito de entrega seleccionando cliente, almacen, fecha, y agregando lineas de productos con cantidad. El stock se valida y descuenta al guardar. Se puede editar un remito en PENDING_DELIVERY con reversion y re-descuento de stock.

#### Fase 6: UI - Detalle y acciones
- **Objetivo:** Implementar la vista de detalle del remito con toda la informacion y los botones de accion segun el estado.
- **Tareas:**
  - [ ] Crear directorio `src/modules/commercial/features/sales/features/delivery-notes/detail/`.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/detail/DeliveryNoteDetail.tsx` (Server Component): Obtener remito por ID, renderizar con PermissionGuard. Mostrar: numero y estado (Badge), informacion del cliente (razon social, CUIT, direccion, telefono, email), almacen, fecha de entrega, observaciones, tabla de lineas (producto, descripcion, cantidad, notas), factura vinculada (si INVOICED).
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/detail/components/_DeliveryNoteActions.tsx` (Client Component): Botones de accion segun estado y permisos:
    - PENDING_DELIVERY: Editar (hasPermission update, navega a edit), Aceptar (hasPermission approve, AlertDialog de confirmacion), Cancelar (hasPermission delete, AlertDialog), Eliminar (hasPermission delete, AlertDialog).
    - ACCEPTED: Cancelar (hasPermission delete, AlertDialog). Facturar se maneja desde la vista de facturacion (Fase 7).
    - INVOICED: Sin acciones (solo ver factura vinculada).
    - CANCELLED: Sin acciones.
    - UseMutation para cada accion con invalidacion de queries y redireccion/revalidacion.
  - [ ] Crear `src/app/(core)/dashboard/commercial/delivery-notes/[id]/page.tsx`: Pagina thin para detalle.
- **Archivos:**
  - Crear: `src/modules/commercial/features/sales/features/delivery-notes/detail/DeliveryNoteDetail.tsx`, `src/modules/commercial/features/sales/features/delivery-notes/detail/components/_DeliveryNoteActions.tsx`, `src/app/(core)/dashboard/commercial/delivery-notes/[id]/page.tsx`
- **Criterio de completitud:** Se puede ver el detalle de un remito con toda la informacion, ejecutar acciones de aceptar/cancelar/eliminar segun el estado, con AlertDialogs de confirmacion y notificaciones toast.

#### Fase 7: Facturacion desde remitos
- **Objetivo:** Implementar la funcionalidad de facturar multiples remitos aceptados del mismo cliente, generando una Factura de Venta en borrador.
- **Tareas:**
  - [ ] Agregar funcion `getAcceptedDeliveryNotesByCustomer(customerId?: string)` en `actions.server.ts`: Obtener remitos en estado ACCEPTED, opcionalmente filtrados por cliente. Incluir customer, warehouse, lines (con product). Agrupar por cliente para mostrar en la vista.
  - [ ] Agregar funcion `invoiceDeliveryNotes(deliveryNoteIds: string[])` en `actions.server.ts`: En transaccion: verificar que todos los remitos existen, son del mismo cliente, estan en ACCEPTED. Crear SalesInvoice DRAFT con las lineas combinadas (sin precio, el usuario completara despues). Actualizar remitos a INVOICED con salesInvoiceId. CheckPermission `commercial.delivery-notes` `approve` y `commercial.invoices` `create`.
  - [ ] Crear `src/modules/commercial/features/sales/features/delivery-notes/list/components/_InvoicePendingDeliveryNotes.tsx` (Client Component): Vista/modal que muestra remitos ACCEPTED agrupados por cliente. Permite seleccionar multiples remitos del mismo cliente con checkboxes. Boton "Facturar Seleccionados" que invoca `invoiceDeliveryNotes`. Mostrar AlertDialog de confirmacion con resumen de lo que se va a facturar. Al completar, redirigir a la factura de venta creada (DRAFT) para que el usuario complete precios.
  - [ ] Agregar boton "Facturar Remitos" en la barra de acciones del listado (con PermissionGuard) que abre la vista de facturacion pendiente.
- **Archivos:**
  - Modificar: `src/modules/commercial/features/sales/features/delivery-notes/list/actions.server.ts`
  - Crear: `src/modules/commercial/features/sales/features/delivery-notes/list/components/_InvoicePendingDeliveryNotes.tsx`
  - Modificar: `src/modules/commercial/features/sales/features/delivery-notes/list/DeliveryNotesList.tsx` o `_DeliveryNotesTable.tsx` (agregar boton)
- **Criterio de completitud:** Se pueden seleccionar multiples remitos ACCEPTED del mismo cliente, facturarlos juntos generando una SalesInvoice DRAFT, los remitos pasan a INVOICED con la referencia a la factura.

#### Fase 8: Integracion con clientes
- **Objetivo:** Mostrar los remitos de entrega en el detalle del cliente.
- **Tareas:**
  - [ ] Identificar el componente de detalle de cliente en `src/modules/commercial/features/sales/` o en la seccion de clientes (Contractor).
  - [ ] Agregar una tab o seccion "Remitos de Entrega" en el detalle del cliente que liste los remitos asociados con estado, fecha, numero y factura vinculada (si INVOICED).
  - [ ] Usar `useQuery` para obtener los remitos del cliente desde una nueva action `getDeliveryNotesByCustomer(customerId: string)` o filtrar los existentes.
- **Archivos:**
  - Modificar: Componente de detalle de cliente (identificar archivo exacto).
  - Posiblemente modificar: `src/modules/commercial/features/sales/features/delivery-notes/list/actions.server.ts` (agregar query por cliente).
- **Criterio de completitud:** En el detalle de un cliente se puede ver la lista de remitos de entrega asociados con su estado y factura vinculada.

#### Fase 9: Sidebar, documentacion y tests
- **Objetivo:** Completar la documentacion del desarrollador, la guia de usuario, y los tests E2E.
- **Tareas:**
  - [ ] Actualizar `docs/modules/commercial.md`: agregar seccion "Remitos de Entrega" con descripcion del modulo, modelos (DeliveryNote, DeliveryNoteLine), flujo de estados (PENDING_DELIVERY -> ACCEPTED -> INVOICED, cancelacion), funcionalidades (CRUD, stock, facturacion multi-remito), integracion con facturas de venta.
  - [ ] Actualizar `docs/architecture/data-model.md`: agregar modelos DeliveryNote y DeliveryNoteLine con sus campos y relaciones.
  - [ ] Actualizar guia de usuario en `src/modules/help/features/guide/components/_CommercialGuide.tsx` (o crear seccion en la guia apropiada): documentar el flujo de remitos de entrega en lenguaje simple para el usuario final.
  - [ ] Crear `cypress/e2e/commercial/delivery-notes.cy.ts` con los siguientes tests:
    - Navegacion: verificar que el item "Remitos de Entrega" aparece en el sidebar y navega correctamente.
    - Crear remito: abrir formulario, seleccionar cliente, almacen, agregar lineas con productos y cantidades, guardar, verificar que aparece en la tabla con estado "Pendiente de Entrega".
    - Ver detalle: click en un remito, verificar que muestra la informacion completa.
    - Aceptar remito: desde el detalle, aceptar, verificar cambio de estado a "Aceptado".
    - Editar remito: solo en PENDING_DELIVERY, modificar lineas, guardar.
    - Cancelar remito: verificar AlertDialog de confirmacion y cambio de estado.
    - Eliminar remito borrador: verificar AlertDialog y eliminacion.
    - Facturar remitos: seleccionar remitos aceptados, facturar, verificar creacion de factura DRAFT.
  - [ ] Agregar task de limpieza en `cypress/support/db.ts` para eliminar datos de test de remitos de entrega: `cleanupDeliveryNotes(companyId)`.
  - [ ] Registrar la task en `cypress.config.ts`.
- **Archivos:**
  - Modificar: `docs/modules/commercial.md`, `docs/architecture/data-model.md`, `src/modules/help/features/guide/components/_CommercialGuide.tsx`
  - Crear: `cypress/e2e/commercial/delivery-notes.cy.ts`
  - Modificar: `cypress/support/db.ts`, `cypress.config.ts`
- **Criterio de completitud:** La documentacion refleja la implementacion, la guia de usuario describe el flujo para el usuario final, `npm run cy:run:commercial` pasa todos los tests de remitos de entrega sin errores.

### 2.2 Orden de ejecucion

```
Fase 1 (Modelo de datos y permisos) ──> Fase 2 (Validators y tipos) ──> Fase 3 (Server Actions)
                                                                                  │
                                                                                  ▼
                                                                           Fase 4 (UI Listado)
                                                                                  │
                                                                                  ▼
                                                                           Fase 5 (UI Crear/Editar)
                                                                                  │
                                                                                  ▼
                                                                           Fase 6 (UI Detalle)
                                                                                  │
                                                                                  ▼
                                                                           Fase 7 (Facturacion)
                                                                                  │
                                                                                  ▼
                                                                           Fase 8 (Integracion clientes)
                                                                                  │
                                                                                  ▼
                                                                           Fase 9 (Docs y Tests)
```

**Dependencias clave:**
- **Fase 1 es prerequisito de todo**: sin modelos y permisos no hay nada que construir.
- **Fase 2 depende de Fase 1**: los validators usan el enum DeliveryNoteStatus generado por Prisma.
- **Fase 3 depende de Fases 1 y 2**: las server actions usan los modelos y los schemas de validacion.
- **Fase 4 depende de Fase 3**: la UI necesita las actions para obtener y mostrar datos.
- **Fase 5 depende de Fases 3 y 4**: el formulario usa las actions y la navegacion desde el listado.
- **Fase 6 depende de Fases 3 y 5**: el detalle muestra datos y acciones que dependen de las actions.
- **Fase 7 depende de Fase 6**: la facturacion requiere que los remitos esten en ACCEPTED (flujo completo).
- **Fase 8 depende de Fase 4**: la integracion con clientes muestra datos del listado.
- **Fase 9 depende de todas las fases anteriores**: tests y docs cubren todo el flujo.

### 2.3 Estimacion de complejidad

| Fase | Complejidad | Justificacion |
|------|-------------|---------------|
| Fase 1: Modelo de datos y permisos | Media | Dos modelos, un enum, multiples relaciones a agregar en modelos existentes, migracion, y registro de permisos. Mas relaciones que un modelo simple. |
| Fase 2: Validators y tipos | Baja | Schemas Zod sencillos siguiendo el patron exacto de receiving notes. Constantes de labels y variants. |
| Fase 3: Server Actions - CRUD | Alta | La logica de stock al crear (no al confirmar) es diferente al patron de receiving notes. La edicion con reversion de stock dentro de transaccion es compleja. Son ~10 funciones con manejo de stock transaccional. |
| Fase 4: UI - Listado | Media | DataTable estandar con filtros facetados, busqueda, y paginacion server-side. Ruta, sidebar, navegacion. Patron establecido. |
| Fase 5: UI - Crear y Editar | Media | Formulario con tabla de lineas dinamica, selects con busqueda, DatePicker. La edicion reutiliza el formulario. Similar al patron de receiving notes. |
| Fase 6: UI - Detalle y acciones | Media | Vista de detalle con acciones condicionales segun estado. AlertDialogs para confirmaciones. Patron establecido en receiving notes. |
| Fase 7: Facturacion desde remitos | Alta | Logica de negocio nueva: seleccion multi-remito, validacion de mismo cliente, creacion de SalesInvoice DRAFT con lineas combinadas, actualizacion de estados. No hay patron previo en el codebase para esta funcionalidad. |
| Fase 8: Integracion con clientes | Baja | Agregar tab/seccion en detalle de cliente existente. Query simple de remitos filtrados por customerId. |
| Fase 9: Sidebar, docs y tests | Media | ~8 test cases cubriendo todo el flujo, documentacion de desarrollador y usuario, cleanup de datos. |

**Complejidad total estimada: Media-Alta**
Las fases criticas son la 3 (server actions con stock transaccional al crear en lugar de confirmar) y la 7 (facturacion multi-remito sin patron previo). El resto sigue patrones establecidos en el codebase, particularmente el modulo de receiving notes.

### 2.4 Riesgos y consideraciones

1. **Stock se descuenta al CREAR, no al confirmar**: Este es el cambio mas significativo respecto al patron de receiving notes. En receiving notes, el stock se suma al confirmar (DRAFT -> CONFIRMED). En delivery notes, el stock se descuenta al crear (directamente en PENDING_DELIVERY). Esto requiere que toda la logica de creacion + verificacion de stock + descuento este en una unica transaccion atomica. Si falla cualquier paso, todo se revierte.

2. **Edicion requiere reversion + re-descuento atomico**: Al editar un remito PENDING_DELIVERY, se debe en una sola transaccion: (a) revertir el stock de las lineas anteriores, (b) verificar stock suficiente para las nuevas lineas, (c) descontar stock de las nuevas lineas. Si las nuevas lineas tienen productos diferentes o cantidades mayores que las anteriores, la verificacion de stock debe considerar el stock "devuelto" de las lineas anteriores.

3. **Facturacion multi-remito y precios**: Los remitos de entrega solo registran cantidades, no precios. Al crear la SalesInvoice DRAFT desde remitos, las lineas se crean sin precio unitario ni IVA. El usuario debe completar estos datos antes de confirmar la factura. Esto podria ser confuso para el usuario si espera que los precios se completen automaticamente. Considerar tomar precios de la lista de precios del producto si existe.

4. **Cancelacion de factura vinculada**: Si una SalesInvoice vinculada a remitos INVOICED se cancela, los remitos deberian volver a ACCEPTED. En la primera iteracion, este caso no se maneja automaticamente. Documentar como limitacion conocida.

5. **Estado INVOICED crea acoplamiento**: El campo `salesInvoiceId` en DeliveryNote crea un acoplamiento directo con SalesInvoice. Si en el futuro se necesita desvincular un remito de una factura (por ejemplo, para re-facturarlo), se necesitara logica adicional.

6. **Concurrencia en stock**: Dos usuarios podrian crear remitos simultaneamente para el mismo producto en el mismo almacen, potencialmente excediendo el stock disponible. La transaccion de Prisma con verificacion de stock mitigaria esto, pero depende del nivel de aislamiento de la BD.
