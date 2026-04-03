# Configuracion de Dashboard por Usuario

**Fecha:** 2026-04-03
**Alcance:** Permitir a cada usuario personalizar su dashboard: elegir que widgets ver y si los acordeones inician abiertos o cerrados.

---

## Almacenamiento

**localStorage** con key `dashboard-prefs-{companyId}`.

```typescript
interface DashboardPreferences {
  hiddenWidgets: string[];  // IDs de widgets ocultos (default: [])
  accordionsOpen: boolean;  // true = abiertos, false = cerrados (default: true)
}
```

### Widget IDs

| ID | Widget | Categoria |
|----|--------|-----------|
| `kpi-sales` | Ventas del Mes | KPIs |
| `kpi-purchases` | Compras del Mes | KPIs |
| `kpi-expenses` | Gastos del Mes | KPIs |
| `kpi-receivables` | Pendiente de Cobro | KPIs |
| `kpi-payables` | Pendiente de Pago | KPIs |
| `kpi-critical-stock` | Stock Critico | KPIs |
| `kpi-bank-balance` | Saldo Bancario | KPIs |
| `chart-profitability` | Rentabilidad Mensual | Graficos |
| `chart-sales-trend` | Tendencia de Ventas | Graficos |
| `chart-purchases-trend` | Tendencia de Compras | Graficos |
| `chart-weekly-sales` | Ventas Semanales | Graficos |
| `widget-payment-methods` | Medios de Pago | Comercial |
| `widget-client-debts` | Top 10 Deudas de Clientes | Comercial |
| `widget-supplier-debts` | Top 10 Deudas de Proveedores | Comercial |
| `widget-top-products` | Productos Mas Vendidos | Comercial |
| `widget-due-dates` | Proximos Vencimientos | Operativo |
| `widget-critical-stock` | Stock Critico (lista) | Operativo |
| `widget-alerts` | Alertas y Vencimientos | Operativo |

---

## Componentes Nuevos

### 1. Hook: `useDashboardPreferences`

**Ubicacion:** `src/modules/dashboard/hooks/useDashboardPreferences.ts`

- Lee/escribe localStorage
- Recibe `companyId` (del contexto o prop)
- Retorna `{ preferences, setPreferences, toggleWidget, resetDefaults }`
- Valores por defecto: todos visibles, acordeones abiertos

### 2. Constante: `DASHBOARD_WIDGETS`

**Ubicacion:** `src/modules/dashboard/constants.ts`

Array con la definicion de cada widget: `{ id, label, category }`. Agrupados por categoria para renderizar checkboxes.

Categorias:
- KPIs
- Graficos
- Comercial
- Operativo

### 3. Componente: `_DashboardSettingsDialog`

**Ubicacion:** `src/modules/dashboard/components/_DashboardSettingsDialog.tsx`

Client component. Dialog con:
- **Seccion 1:** Switch "Iniciar widgets abiertos"
- **Seccion 2:** Checkboxes agrupados por categoria con label del widget
- **Boton:** "Restaurar valores por defecto"
- Los cambios se aplican inmediatamente (sin boton guardar)

### 4. Componente: `_DashboardGrid`

**Ubicacion:** `src/modules/dashboard/components/_DashboardGrid.tsx`

Client component que recibe TODOS los datos del server y las preferencias. Renderiza condicionalmente cada widget segun `hiddenWidgets`. Pasa `defaultOpen={accordionsOpen}` a cada `_CollapsibleCard`.

### 5. Pagina: Configuracion de Empresa > Dashboard

**Ubicacion pagina:** `src/app/(core)/dashboard/company/dashboard-settings/page.tsx`
**Ubicacion componente:** `src/modules/dashboard/features/settings/DashboardSettings.tsx`

Pagina en la seccion de configuracion de empresa que reutiliza `_DashboardSettingsDialog` (o un componente compartido de formulario extraido del dialog).

---

## Cambios en Componentes Existentes

### DashboardContent.tsx

- Deja de renderizar widgets directamente
- Pasa todos los datos fetched a `_DashboardGrid`
- El boton de configuracion (engranaje) se agrega al header junto a `_PeriodSelector` y `_MonthsRangeSelector`

### _CollapsibleCard.tsx

- Recibir prop `defaultOpen` desde el padre (ya la tiene)
- Sin cambios adicionales necesarios

### KPI Cards

- Las 7 KPI cards en DashboardContent se mueven a `_DashboardGrid` ya que necesitan logica client-side para ocultarlas condicionalmente

### Sidebar (_AppSidebar.tsx)

- Agregar item "Dashboard" en el grupo "General" de Empresa con ruta `/dashboard/company/dashboard-settings`

---

## Flujo de Datos

```
page.tsx (Server)
  -> DashboardContent (Server) - fetch de TODOS los datos
    -> _DashboardGrid (Client) - lee localStorage, filtra widgets
      -> KPI Cards (condicional)
      -> _ProfitabilityChart (condicional)
      -> _SalesTrendChart (condicional)
      -> ... demas widgets
      -> _DashboardSettingsDialog (boton engranaje en header)
```

---

## Permisos

- La configuracion es por usuario, sin restriccion de permisos (cada usuario configura su propia vista)
- La pagina en Empresa > General si requiere permiso de `dashboard.view` para acceder
- No se crea modulo de permiso nuevo ya que no es un recurso compartido

---

## Consideraciones

- **Primera visita:** Sin key en localStorage, se usan defaults (todo visible, acordeones abiertos)
- **Cambio de empresa:** La key incluye `companyId`, cada empresa tiene su config
- **Datos del server:** Se fetchean SIEMPRE todos los datos aunque algunos widgets esten ocultos. Esto simplifica la arquitectura y evita recarga al cambiar preferencias. En el futuro se podria optimizar.
- **Responsive:** El dialog de configuracion usa grid responsive para los checkboxes
