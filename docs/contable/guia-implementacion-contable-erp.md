# Guía de implementación contable en un ERP (Argentina)

> Objetivo: que tu ERP registre automáticamente todo lo que ocurre en la operación (ventas, compras, cobros, pagos, sueldos, etc.) en forma de asientos contables válidos, y que el **contador de la empresa** pueda usar el sistema para llevar libros, liquidar IVA y retenciones, presentar a ARCA y armar balances.
>
> Stack asumido: **PostgreSQL**. Solo se explica contabilidad donde es estrictamente necesario para que el modelo cierre.

---

## Las 5 reglas mínimas de contabilidad que SÍ necesitás entender

No hace falta que aprendas contabilidad, pero estas 5 reglas determinan el diseño de las tablas. Si las respetás, lo demás es ingeniería.

1. **Partida doble.** Todo hecho económico se registra como un *asiento* compuesto por 2 o más *renglones* (líneas). En cada asiento, la suma de lo que va al **Debe** es exactamente igual a la suma de lo que va al **Haber**. `SUM(debe) = SUM(haber)`. Esta es la invariante central del sistema: si no se cumple, el asiento no se puede guardar.

2. **Plan de cuentas.** Es el catálogo jerárquico de "cajones" donde se clasifica cada movimiento (Caja, Banco, Clientes, Proveedores, Ventas, IVA Débito Fiscal, etc.). Cada renglón de asiento imputa a **una cuenta imputable** (hoja del árbol).

3. **Naturaleza de la cuenta.** Cada cuenta pertenece a un tipo: Activo, Pasivo, Patrimonio Neto, Ingreso (Resultado +) o Egreso (Resultado −). El tipo define cómo suma su saldo (Debe − Haber, o Haber − Debe) y a qué estado contable va (Balance vs. Estado de Resultados).

4. **Período / ejercicio.** Los asientos pertenecen a un *ejercicio* (año fiscal) y a un *período* (mes). Los períodos se **cierran** para que nadie modifique el pasado. Al fin del ejercicio, las cuentas de resultado se "vacían" contra el patrimonio (refundición/cierre) y arranca uno nuevo.

5. **Inmutabilidad.** Un asiento contabilizado **no se edita ni se borra**; se corrige con otro asiento (reversa/contraasiento). Esto es requisito legal y de auditoría.

Todo el resto del documento implementa estas 5 reglas.

---

## Mapa general (cómo se conecta todo)

```
 MÓDULOS OPERATIVOS                 PUENTE CONTABLE              CONTABILIDAD (Libro Diario/Mayor)
 ┌───────────────┐
 │ Ventas        │──comprobante──┐
 │ Compras       │──comprobante──┤
 │ Tesorería     │──recibo/OP────┤   ┌──────────────────┐      ┌───────────────────────────┐
 │ Stock         │──movimiento───┼──▶│ Reglas de         │─────▶│ asiento + asiento_renglon │
 │ Sueldos       │──liquidación──┤   │ contabilización   │      │ (partida doble, inmutable)│
 │ Bienes de uso │──amortización─┘   │ (mapeo → cuentas) │      └─────────────┬─────────────┘
 └───────────────┘                   └──────────────────┘                    │
                                                                              ▼
                       IMPUESTOS                                      VISTAS / REPORTES
                ┌──────────────────────┐                    ┌───────────────────────────────┐
                │ IVA débito/crédito    │◀───────────────────│ Mayor, Sumas y Saldos,        │
                │ Retenciones/Percep.   │                    │ Libro IVA, Balance, EECC      │
                └───────────┬──────────┘                    └───────────────────────────────┘
                            ▼
                   INTEGRACIÓN ARCA (ex AFIP)
                ┌──────────────────────────────┐
                │ WSAA + WSFEv1/WSFEX (CAE)     │
                │ Libro IVA Digital, SIRE, IIBB │
                └──────────────────────────────┘
```

El concepto clave es el **puente contable**: los módulos operativos NO escriben asientos directamente. Generan un *comprobante operativo* (factura, recibo, liquidación) y un motor de reglas lo traduce a un asiento. Así el contador controla el "cómo se contabiliza" sin tocar código.

---

# FASE 0 — Fundaciones del proyecto

Antes de la primera tabla contable, dejá resueltos estos transversales porque después son carísimos de cambiar.

| Decisión | Recomendación | Por qué |
|---|---|---|
| Moneda y decimales | `NUMERIC(18,2)` para importes, `NUMERIC(18,6)` para cantidades/tipos de cambio | Nunca `float`: introduce errores de centavos que rompen la partida doble |
| Multi-empresa | Columna `empresa_id` en todas las tablas + Row Level Security | Un estudio o grupo maneja varias razones sociales |
| Multi-moneda | Guardar importe en moneda origen + importe en moneda funcional (ARS) + tipo de cambio | AFIP/ARCA y balances exigen pesos; operás en USD a veces |
| Auditoría | Columnas `created_at, created_by, updated_at` + tabla `audit_log` por trigger | Requisito legal de trazabilidad |
| Numeración | Secuencias por tipo de comprobante/punto de venta, **sin huecos** en lo legal | El Libro Diario y los comprobantes no pueden saltear números |
| Inmutabilidad | Estados de asiento + triggers que bloquean UPDATE/DELETE de contabilizados | Regla 5 |

```sql
-- Tipos base reutilizados en todo el modelo
CREATE TYPE naturaleza_cuenta AS ENUM ('ACTIVO','PASIVO','PATRIMONIO','INGRESO','EGRESO','ORDEN');
CREATE TYPE estado_asiento    AS ENUM ('BORRADOR','CONTABILIZADO','ANULADO');
CREATE TYPE tipo_periodo      AS ENUM ('MENSUAL','APERTURA','CIERRE','AJUSTE');
```

---

# FASE 1 — Modelo de datos núcleo (Plan de cuentas + ejercicios)

Esta fase crea el "esqueleto" sobre el que todo lo demás imputa.

### 1.1 Plan de cuentas (cuenta)

Árbol jerárquico. Solo las **hojas** (`imputable = true`) reciben asientos; los nodos padre solo agrupan para reportes.

```sql
CREATE TABLE cuenta (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id    BIGINT NOT NULL,
    codigo        VARCHAR(30) NOT NULL,        -- '1.1.01.001'
    nombre        VARCHAR(150) NOT NULL,       -- 'Caja en pesos'
    naturaleza    naturaleza_cuenta NOT NULL,
    cuenta_padre_id BIGINT REFERENCES cuenta(id),
    imputable     BOOLEAN NOT NULL DEFAULT false,  -- ¿es hoja? sólo estas reciben asientos
    nivel         SMALLINT NOT NULL,
    ajustable_inflacion BOOLEAN NOT NULL DEFAULT false, -- para RECPAM (ajuste por inflación)
    requiere_auxiliar VARCHAR(20),             -- 'CLIENTE','PROVEEDOR','BANCO',NULL
    moneda        CHAR(3) DEFAULT 'ARS',
    activa        BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (empresa_id, codigo)
);
```

Decisión clave: `requiere_auxiliar`. La cuenta "Deudores por ventas" no se desglosa por cada cliente en el plan de cuentas (sería inmanejable). En su lugar, el renglón del asiento guarda un puntero al **auxiliar** (el cliente concreto). Esto es el subdiario / cuenta corriente.

### 1.2 Ejercicio y período contable

```sql
CREATE TABLE ejercicio (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id  BIGINT NOT NULL,
    numero      INT NOT NULL,            -- ejercicio Nº 5
    fecha_inicio DATE NOT NULL,
    fecha_fin    DATE NOT NULL,
    cerrado     BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (empresa_id, numero)
);

CREATE TABLE periodo (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ejercicio_id BIGINT NOT NULL REFERENCES ejercicio(id),
    anio         SMALLINT NOT NULL,
    mes          SMALLINT NOT NULL,
    tipo         tipo_periodo NOT NULL DEFAULT 'MENSUAL',
    cerrado      BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (ejercicio_id, anio, mes)
);
```

### 1.3 Asiento y renglón (el corazón)

```sql
CREATE TABLE asiento (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id   BIGINT NOT NULL,
    periodo_id   BIGINT NOT NULL REFERENCES periodo(id),
    numero       BIGINT NOT NULL,              -- correlativo del Libro Diario (sin huecos)
    fecha        DATE NOT NULL,
    glosa        VARCHAR(255) NOT NULL,        -- descripción/concepto
    estado       estado_asiento NOT NULL DEFAULT 'BORRADOR',
    origen_tipo  VARCHAR(30),                  -- 'VENTA','COMPRA','PAGO','MANUAL','CIERRE'...
    origen_id    BIGINT,                       -- id del comprobante que lo generó (trazabilidad)
    asiento_reversa_id BIGINT REFERENCES asiento(id), -- si es contraasiento
    total_debe   NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_haber  NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_by   BIGINT, created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (empresa_id, numero),
    CONSTRAINT chk_balanceado CHECK (total_debe = total_haber)
);

CREATE TABLE asiento_renglon (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asiento_id   BIGINT NOT NULL REFERENCES asiento(id) ON DELETE CASCADE,
    cuenta_id    BIGINT NOT NULL REFERENCES cuenta(id),
    debe         NUMERIC(18,2) NOT NULL DEFAULT 0,
    haber        NUMERIC(18,2) NOT NULL DEFAULT 0,
    detalle      VARCHAR(255),
    -- punteros a auxiliares (cuenta corriente):
    cliente_id   BIGINT,
    proveedor_id BIGINT,
    -- centro de costo / dimensiones analíticas (opcional pero muy recomendado):
    centro_costo_id BIGINT,
    -- multimoneda:
    moneda       CHAR(3) DEFAULT 'ARS',
    importe_me   NUMERIC(18,2),               -- importe en moneda extranjera
    tipo_cambio  NUMERIC(18,6),
    CONSTRAINT chk_debe_o_haber CHECK (
        (debe > 0 AND haber = 0) OR (haber > 0 AND debe = 0)
    )
);

CREATE INDEX ix_renglon_cuenta ON asiento_renglon(cuenta_id);
CREATE INDEX ix_renglon_cliente ON asiento_renglon(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX ix_renglon_proveedor ON asiento_renglon(proveedor_id) WHERE proveedor_id IS NOT NULL;
```

### 1.4 Cruces de esta fase (integridad)

| Cruce | Regla |
|---|---|
| `asiento_renglon.cuenta_id` → `cuenta` | La cuenta debe tener `imputable = true` (validar por trigger) |
| `asiento` → `periodo` | El período no debe estar `cerrado` |
| `asiento.fecha` ∈ `[periodo.inicio, periodo.fin]` | La fecha cae dentro del período |
| `SUM(debe) = SUM(haber)` por asiento | Partida doble (validar por trigger antes de CONTABILIZADO) |
| Renglón con cuenta `requiere_auxiliar='CLIENTE'` → exige `cliente_id` | Subdiario consistente |

**Entregable de la Fase 1:** poder cargar un asiento manual, validado y balanceado, y verlo en el Mayor. Si esto funciona, el motor contable ya existe.

---

# FASE 2 — Motor de registración (transacciones y validaciones)

Acá convertís las tablas en un sistema seguro. Todo se hace dentro de **transacciones** de PostgreSQL para que un asiento nunca quede a medias.

### 2.1 Transacción "contabilizar asiento"

Función que valida y pasa un asiento de BORRADOR a CONTABILIZADO de forma atómica.

```sql
CREATE OR REPLACE FUNCTION contabilizar_asiento(p_asiento_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_debe NUMERIC(18,2); v_haber NUMERIC(18,2); v_periodo_cerrado BOOLEAN;
BEGIN
    -- 1) bloqueo de fila para evitar doble contabilización concurrente
    PERFORM 1 FROM asiento WHERE id = p_asiento_id AND estado='BORRADOR' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Asiento inexistente o ya contabilizado'; END IF;

    -- 2) período abierto
    SELECT p.cerrado INTO v_periodo_cerrado
    FROM asiento a JOIN periodo p ON p.id = a.periodo_id WHERE a.id = p_asiento_id;
    IF v_periodo_cerrado THEN RAISE EXCEPTION 'Período cerrado'; END IF;

    -- 3) partida doble
    SELECT COALESCE(SUM(debe),0), COALESCE(SUM(haber),0) INTO v_debe, v_haber
    FROM asiento_renglon WHERE asiento_id = p_asiento_id;
    IF v_debe <> v_haber OR v_debe = 0 THEN
        RAISE EXCEPTION 'Asiento desbalanceado: debe=% haber=%', v_debe, v_haber;
    END IF;

    -- 4) sólo cuentas imputables
    IF EXISTS (SELECT 1 FROM asiento_renglon r JOIN cuenta c ON c.id=r.cuenta_id
               WHERE r.asiento_id=p_asiento_id AND c.imputable=false) THEN
        RAISE EXCEPTION 'Hay renglones sobre cuentas no imputables';
    END IF;

    -- 5) numerar (correlativo sin huecos) y confirmar
    UPDATE asiento
       SET estado='CONTABILIZADO', total_debe=v_debe, total_haber=v_haber,
           numero = nextval('seq_asiento_'||empresa_id)  -- una secuencia por empresa
     WHERE id = p_asiento_id;
END $$;
```

### 2.2 Inmutabilidad por trigger

```sql
CREATE OR REPLACE FUNCTION bloquear_asiento_contabilizado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.estado = 'CONTABILIZADO' AND TG_OP IN ('UPDATE','DELETE') THEN
        -- sólo se permite pasar a ANULADO vía reversa controlada
        IF TG_OP='UPDATE' AND NEW.estado='ANULADO' THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'Un asiento contabilizado no se modifica ni borra; usá una reversa';
    END IF;
    RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_inmutable BEFORE UPDATE OR DELETE ON asiento
FOR EACH ROW EXECUTE FUNCTION bloquear_asiento_contabilizado();
```

### 2.3 Reversa / contraasiento

Para corregir, se genera un asiento espejo (Debe↔Haber invertidos) apuntando al original. Nunca se edita el pasado.

```sql
CREATE OR REPLACE FUNCTION revertir_asiento(p_asiento_id BIGINT, p_fecha DATE)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_nuevo BIGINT;
BEGIN
    INSERT INTO asiento(empresa_id,periodo_id,fecha,glosa,estado,origen_tipo,asiento_reversa_id)
    SELECT empresa_id, periodo_id, p_fecha, 'REVERSA: '||glosa, 'BORRADOR','REVERSA', id
    FROM asiento WHERE id=p_asiento_id RETURNING id INTO v_nuevo;

    INSERT INTO asiento_renglon(asiento_id,cuenta_id,debe,haber,detalle,cliente_id,proveedor_id)
    SELECT v_nuevo, cuenta_id, haber, debe, detalle, cliente_id, proveedor_id  -- invertido
    FROM asiento_renglon WHERE asiento_id=p_asiento_id;

    PERFORM contabilizar_asiento(v_nuevo);
    UPDATE asiento SET estado='ANULADO' WHERE id=p_asiento_id;
    RETURN v_nuevo;
END $$;
```

**Entregable de la Fase 2:** asientos atómicos, validados, inmutables y reversables. A partir de acá nadie puede dejar la contabilidad inconsistente.

---

# FASE 3 — Puente contable: integración con módulos operativos (los "cruces")

Esta es la fase que más subestima la gente y la que da el valor real del ERP. Los módulos operativos generan comprobantes; el **motor de reglas** los traduce a asientos. Así el contador define la imputación sin programar.

### 3.1 Maestros auxiliares (sujetos)

```sql
CREATE TABLE entidad (                      -- clientes y proveedores unificados
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id    BIGINT NOT NULL,
    tipo          VARCHAR(10) NOT NULL,      -- 'CLIENTE','PROVEEDOR','AMBOS'
    razon_social  VARCHAR(150) NOT NULL,
    cuit          VARCHAR(13),
    condicion_iva VARCHAR(30) NOT NULL,      -- 'RI','MONOTRIBUTO','EXENTO','CF'
    cuenta_cte_id BIGINT REFERENCES cuenta(id),  -- cuenta contable que usa (Deudores/Proveedores)
    -- datos para retenciones:
    condicion_ganancias VARCHAR(20),
    condicion_iibb      VARCHAR(20),
    jurisdiccion_iibb   VARCHAR(40),
    UNIQUE (empresa_id, cuit)
);
```

### 3.2 Tabla de reglas de contabilización (el mapeo configurable)

El truco profesional: NO hardcodear cuentas. Una tabla dice "para este tipo de operación, esta línea va a esta cuenta".

```sql
CREATE TABLE regla_contable (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id    BIGINT NOT NULL,
    evento        VARCHAR(40) NOT NULL,   -- 'VENTA','COMPRA','COBRANZA','PAGO','SUELDO'...
    concepto      VARCHAR(40) NOT NULL,   -- 'NETO_GRAVADO','IVA_DEBITO','DEUDOR','RET_IVA'...
    lado          CHAR(1) NOT NULL,       -- 'D' debe / 'H' haber
    cuenta_id     BIGINT REFERENCES cuenta(id),
    -- resolución dinámica cuando la cuenta depende del sujeto:
    usar_cuenta_entidad BOOLEAN DEFAULT false, -- p.ej. usar entidad.cuenta_cte_id
    condicion     JSONB,                  -- filtros opcionales (alícuota, jurisdicción...)
    UNIQUE (empresa_id, evento, concepto)
);
```

### 3.3 Catálogo de cruces principales (qué asiento genera cada módulo)

Esta tabla es tu hoja de ruta de integración. Cada fila es un "evento" que tu ERP debe saber contabilizar.

| Módulo / Evento | Comprobante operativo | Asiento típico (Debe → Haber) |
|---|---|---|
| **Ventas** – Factura A/B | factura de venta | **D**: Deudores por ventas (total) — **H**: Ventas (neto) + IVA Débito Fiscal + Percepciones que cobrás |
| **Ventas** – Nota de crédito | NC venta | Inverso de la factura |
| **Cobranzas** | recibo | **D**: Caja/Banco + Ret. sufridas (cert. de retención) — **H**: Deudores por ventas |
| **Compras** – Factura | factura de compra | **D**: Gasto/Mercadería (neto) + IVA Crédito Fiscal + Percepciones sufridas — **H**: Proveedores |
| **Pagos** | orden de pago | **D**: Proveedores — **H**: Caja/Banco + Retenciones que practicás (pasivo a depositar) |
| **Stock** – Egreso por venta (CMV) | movimiento de stock | **D**: Costo de Mercadería Vendida — **H**: Mercadería de reventa |
| **Stock** – Ingreso por compra | recepción | **D**: Mercadería — **H**: Mercadería en tránsito / Proveedores |
| **Tesorería** – Transferencia | mov. bancario | **D**: Banco destino — **H**: Banco origen (+ comisiones, IVA s/comisión) |
| **Tesorería** – Cheques | cartera/depósito | **D**: Valores a depositar / **H**: según circuito |
| **Sueldos** | liquidación de haberes | **D**: Sueldos y cargas — **H**: Sueldos a pagar + Aportes/Contribuciones + Sindicato |
| **Bienes de uso** – Alta | factura de compra de BU | **D**: Rodados/Maquinarias — **H**: Proveedores |
| **Bienes de uso** – Amortización | proceso mensual/anual | **D**: Amortización (gasto) — **H**: Amortización acumulada |
| **Impuestos** – Liquidación IVA | DDJJ IVA | **D**: IVA Débito — **H**: IVA Crédito + IVA a pagar (o Saldo a favor) |
| **Diferencias de cambio** | revaluación ME | **D/H**: Diferencia de cambio según signo |

### 3.4 Patrón de integración recomendado

```
1. El módulo operativo guarda su comprobante (ej. factura_venta) y lo confirma.
2. Emite un EVENTO (cola/outbox: tabla evento_contable pendiente).
3. Un worker toma el evento, lee regla_contable, arma el asiento (BORRADOR).
4. Llama contabilizar_asiento(). Si falla, el evento queda en error para revisión.
5. Guarda asiento.origen_tipo/origen_id apuntando al comprobante (trazabilidad bidireccional).
```

```sql
-- Patrón "outbox" para desacoplar operación de contabilidad
CREATE TABLE evento_contable (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id   BIGINT NOT NULL,
    evento       VARCHAR(40) NOT NULL,
    origen_tipo  VARCHAR(30) NOT NULL,
    origen_id    BIGINT NOT NULL,
    payload      JSONB NOT NULL,           -- snapshot de importes/sujeto
    estado       VARCHAR(15) DEFAULT 'PENDIENTE', -- PENDIENTE/PROCESADO/ERROR
    asiento_id   BIGINT REFERENCES asiento(id),
    error_msg    TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);
```

> Por qué desacoplar: si la generación del asiento falla (regla faltante, período cerrado), la venta NO se cae. El comprobante existe; el asiento se reprocesa. Esto evita el clásico "no puedo facturar porque la contabilidad dio error".

**Entregable de la Fase 3:** cada operación del negocio produce su asiento automáticamente y se puede navegar del asiento al comprobante y viceversa.

---

# FASE 4 — IVA y Libros de IVA

El IVA necesita datos que el asiento contable no guarda con suficiente detalle (alícuotas, tipo de comprobante AFIP, CUIT, CAE). Por eso se modela un **subdiario de IVA** paralelo, que luego concilia contra las cuentas de IVA del mayor.

### 4.1 Tablas de comprobantes con detalle fiscal

```sql
CREATE TABLE comprobante (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      BIGINT NOT NULL,
    signo           CHAR(1) NOT NULL,          -- 'V' ventas / 'C' compras
    tipo_afip       SMALLINT NOT NULL,         -- código AFIP (1=FacA,6=FacB,11=FacC,3=NC A...)
    letra           CHAR(1),                   -- A/B/C/M/E
    punto_venta     INT NOT NULL,
    numero          BIGINT NOT NULL,
    fecha           DATE NOT NULL,
    entidad_id      BIGINT NOT NULL REFERENCES entidad(id),
    cuit_contraparte VARCHAR(13),
    condicion_iva_contraparte VARCHAR(30),
    neto_gravado    NUMERIC(18,2) DEFAULT 0,
    neto_no_gravado NUMERIC(18,2) DEFAULT 0,
    exento          NUMERIC(18,2) DEFAULT 0,
    total_iva       NUMERIC(18,2) DEFAULT 0,
    total_percepciones NUMERIC(18,2) DEFAULT 0,
    total           NUMERIC(18,2) NOT NULL,
    moneda          CHAR(3) DEFAULT 'ARS',
    tipo_cambio     NUMERIC(18,6) DEFAULT 1,
    -- datos ARCA:
    cae             VARCHAR(14),
    cae_vto         DATE,
    asiento_id      BIGINT REFERENCES asiento(id),
    UNIQUE (empresa_id, signo, tipo_afip, punto_venta, numero)
);

-- IVA discriminado por alícuota (un comprobante puede tener 21% + 10,5% + 27%)
CREATE TABLE comprobante_iva (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comprobante_id  BIGINT NOT NULL REFERENCES comprobante(id) ON DELETE CASCADE,
    alicuota        NUMERIC(5,2) NOT NULL,     -- 21.00, 10.50, 27.00, 0
    base_imponible  NUMERIC(18,2) NOT NULL,
    importe_iva     NUMERIC(18,2) NOT NULL,
    codigo_afip_alicuota SMALLINT                -- 5=21%,4=10.5%,6=27%...
);
```

### 4.2 Cruce contable ↔ fiscal

El asiento de la factura usa las cuentas "IVA Débito Fiscal" (ventas) e "IVA Crédito Fiscal" (compras). El subdiario de IVA debe **cuadrar** con el saldo de esas cuentas en el mayor para el mismo período. Esa conciliación es un control mensual obligatorio.

```sql
-- Vista de control: IVA del subdiario vs IVA del mayor
CREATE VIEW v_control_iva AS
SELECT p.anio, p.mes, c.signo,
       SUM(ci.importe_iva) AS iva_subdiario
FROM comprobante c
JOIN comprobante_iva ci ON ci.comprobante_id = c.id
JOIN asiento a ON a.id = c.asiento_id
JOIN periodo p ON p.id = a.periodo_id
GROUP BY p.anio, p.mes, c.signo;
-- (se compara contra v_mayor filtrando cuentas de IVA débito/crédito)
```

### 4.3 Libro IVA Ventas / Compras (vistas legales)

```sql
CREATE VIEW v_libro_iva_ventas AS
SELECT c.fecha, c.tipo_afip, c.letra, c.punto_venta, c.numero,
       e.razon_social, c.cuit_contraparte, c.condicion_iva_contraparte,
       c.neto_gravado, c.neto_no_gravado, c.exento,
       SUM(ci.importe_iva) FILTER (WHERE ci.alicuota=21)   AS iva_21,
       SUM(ci.importe_iva) FILTER (WHERE ci.alicuota=10.5) AS iva_105,
       SUM(ci.importe_iva) FILTER (WHERE ci.alicuota=27)   AS iva_27,
       c.total_percepciones, c.total, c.cae
FROM comprobante c
JOIN entidad e ON e.id = c.entidad_id
LEFT JOIN comprobante_iva ci ON ci.comprobante_id = c.id
WHERE c.signo = 'V'
GROUP BY c.id, e.razon_social
ORDER BY c.fecha, c.punto_venta, c.numero;
-- Libro IVA Compras: idéntico con signo='C'
```

**Entregable de la Fase 4:** el contador imprime Libro IVA Ventas y Compras del mes, y esos totales concilian contra el mayor. Base para la DDJJ de IVA.

---

# FASE 5 — Retenciones y Percepciones

Concepto mínimo: una **percepción** te la cobran/cobrás *de más* en la factura (un adelanto de impuesto). Una **retención** te la descuentan/descontás *al pagar/cobrar* (te quedás con plata del otro para depositarla al fisco). Ambas generan saldos a favor (las sufridas) o pasivos a depositar (las practicadas).

### 5.1 Configuración de regímenes

```sql
CREATE TABLE regimen_retencion (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id    BIGINT NOT NULL,
    tipo          VARCHAR(15) NOT NULL,   -- 'RET'/'PERC'
    impuesto      VARCHAR(15) NOT NULL,   -- 'GANANCIAS','IVA','IIBB','SUSS'
    jurisdiccion  VARCHAR(40),            -- para IIBB (provincia)
    codigo_regimen VARCHAR(10),           -- código según norma / SIRE
    cuenta_id     BIGINT REFERENCES cuenta(id), -- a favor (sufrida) o a pagar (practicada)
    base_calculo  VARCHAR(20),            -- 'NETO','TOTAL'
    alicuota      NUMERIC(6,3),
    minimo_no_sujeto NUMERIC(18,2) DEFAULT 0,
    minimo_retencion NUMERIC(18,2) DEFAULT 0
);

CREATE TABLE retencion (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      BIGINT NOT NULL,
    regimen_id      BIGINT NOT NULL REFERENCES regimen_retencion(id),
    naturaleza      VARCHAR(10) NOT NULL,   -- 'SUFRIDA'/'PRACTICADA'
    entidad_id      BIGINT NOT NULL REFERENCES entidad(id),
    comprobante_pago_id BIGINT,             -- recibo u orden de pago que la origina
    fecha           DATE NOT NULL,
    base_imponible  NUMERIC(18,2) NOT NULL,
    importe         NUMERIC(18,2) NOT NULL,
    nro_certificado VARCHAR(30),            -- certificado de retención
    asiento_id      BIGINT REFERENCES asiento(id)
);
```

### 5.2 Cruces

| Caso | Dónde se calcula | Impacto contable |
|---|---|---|
| **Percepción en venta** (la cobrás) | al facturar | suma al total de la factura; cuenta "IVA/IIBB Percepciones a depositar" (pasivo) |
| **Percepción en compra** (la sufrís) | al recibir factura | cuenta "Percepciones IVA/IIBB a favor" (activo, crédito fiscal) |
| **Retención al pagar** (la practicás) | en la orden de pago | reduce lo que pagás al proveedor; cuenta "Retenciones a depositar" (pasivo) → genera obligación con ARCA/Rentas |
| **Retención al cobrar** (la sufrís) | en el recibo de cobranza | el cliente te paga menos y te da certificado; cuenta "Retenciones sufridas a favor" (activo) |

### 5.3 Reportes/archivos

El contador necesita, por régimen y período: total a depositar (practicadas) y total a computar en la DDJJ (sufridas), más los **archivos de importación** para los aplicativos/sistemas oficiales (SIRE para retenciones nacionales de IVA y Ganancias; regímenes provinciales de IIBB como SIRCAR/SIRCREB/ARBA, etc.).

```sql
CREATE VIEW v_retenciones_a_depositar AS
SELECT r.fecha, rr.impuesto, rr.jurisdiccion, rr.codigo_regimen,
       e.razon_social, e.cuit, r.base_imponible, r.importe, r.nro_certificado
FROM retencion r
JOIN regimen_retencion rr ON rr.id = r.regimen_id
JOIN entidad e ON e.id = r.entidad_id
WHERE r.naturaleza = 'PRACTICADA'
ORDER BY rr.impuesto, r.fecha;
```

**Entregable de la Fase 5:** generación automática de retenciones/percepciones con su certificado y los listados para depositar y para computar.

---

# FASE 6 — Integración con ARCA (ex AFIP)

> Nota: en octubre de 2024 la AFIP fue reemplazada por **ARCA** (Agencia de Recaudación y Control Aduanero). Los webservices y su lógica siguen vigentes con la misma mecánica.

### 6.1 Facturación electrónica (CAE)

Para que una factura sea válida necesitás un **CAE** (Código de Autorización Electrónico) que otorga ARCA online. Flujo:

```
1. WSAA: autenticación. Con tu certificado X.509 + clave privada firmás un
   "Login Ticket Request"; ARCA devuelve un Token+Sign válido ~12 hs.
2. WSFEv1 (mercado interno) o WSFEX (exportación):
   - FECompUltimoAutorizado: pedís el último número autorizado (para correlatividad).
   - FECAESolicitar: enviás el comprobante (importes, IVA, receptor); ARCA
     devuelve CAE + vencimiento, o rechazo con observaciones.
3. Guardás CAE/cae_vto en comprobante y generás el PDF con QR.
```

```sql
CREATE TABLE arca_credencial (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id   BIGINT NOT NULL,
    cuit         VARCHAR(13) NOT NULL,
    certificado  BYTEA NOT NULL,          -- .crt (cifrado en reposo)
    clave_privada BYTEA NOT NULL,         -- .key (cifrado en reposo / KMS)
    ambiente     VARCHAR(10) DEFAULT 'HOMOLOGACION', -- HOMOLOGACION/PRODUCCION
    token        TEXT, sign TEXT, token_vto TIMESTAMPTZ  -- cache del WSAA
);

CREATE TABLE arca_solicitud (   -- log de cada llamada (auditoría e idempotencia)
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comprobante_id BIGINT REFERENCES comprobante(id),
    servicio      VARCHAR(15),            -- 'WSFEv1'/'WSFEX'
    request       JSONB, response JSONB,
    cae           VARCHAR(14), resultado CHAR(1),  -- 'A' aprobado / 'R' rechazado
    observaciones TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);
```

Puntos críticos de implementación: cachear el Token/Sign del WSAA (no pedir uno por factura), respetar la **correlatividad** por punto de venta y tipo, contemplar **CAEA** (lotes) para contingencia, y mantener entornos de **homologación** y **producción** separados.

### 6.2 Libro IVA Digital (LID)

Declaración mensual obligatoria para Responsables Inscriptos: ventas y compras del período, con sus alícuotas, en el formato/registro que exige ARCA. Tu Fase 4 ya tiene los datos; acá solo generás el archivo de importación con el layout vigente (campos de cabecera + alícuotas + comprobantes), y conciliás contra `v_libro_iva_ventas`/`compras`.

### 6.3 Otros regímenes de información

Según la empresa: SIRE (retenciones nacionales), regímenes provinciales de IIBB, Mis Comprobantes (consulta), padrones de alícuotas de percepción/retención (para resolver alícuotas por CUIT). Modelá la importación de **padrones** porque las alícuotas de retención dependen del padrón del sujeto.

```sql
CREATE TABLE padron_alicuota (   -- alícuotas por CUIT/jurisdicción (se actualiza periódico)
    cuit          VARCHAR(13) NOT NULL,
    impuesto      VARCHAR(15) NOT NULL,
    jurisdiccion  VARCHAR(40),
    alicuota_perc NUMERIC(6,3),
    alicuota_ret  NUMERIC(6,3),
    vigencia_desde DATE, vigencia_hasta DATE,
    PRIMARY KEY (cuit, impuesto, jurisdiccion, vigencia_desde)
);
```

**Entregable de la Fase 6:** facturás con CAE válido y generás el Libro IVA Digital y los archivos de regímenes para presentar.

---

# FASE 7 — Reportes y libros legales (lo que usa el contador)

Todo esto son **vistas/consultas** sobre el núcleo de la Fase 1. No agregan datos; los presentan.

### 7.1 Libro Mayor

```sql
CREATE VIEW v_mayor AS
SELECT r.cuenta_id, c.codigo, c.nombre, a.fecha, a.numero AS asiento_nro,
       a.glosa, r.detalle, r.debe, r.haber,
       SUM(r.debe - r.haber) OVER (
            PARTITION BY r.cuenta_id ORDER BY a.fecha, a.numero, r.id
       ) AS saldo_acumulado
FROM asiento_renglon r
JOIN asiento a ON a.id = r.asiento_id AND a.estado='CONTABILIZADO'
JOIN cuenta  c ON c.id = r.cuenta_id;
```

### 7.2 Libro Diario (legal, correlativo)

```sql
CREATE VIEW v_libro_diario AS
SELECT a.numero, a.fecha, a.glosa, c.codigo, c.nombre, r.debe, r.haber
FROM asiento a
JOIN asiento_renglon r ON r.asiento_id = a.id
JOIN cuenta c ON c.id = r.cuenta_id
WHERE a.estado='CONTABILIZADO'
ORDER BY a.numero, r.id;
```

### 7.3 Balance de Sumas y Saldos

Es la base para armar los estados contables. Suma Debe y Haber por cuenta y calcula el saldo según naturaleza.

```sql
CREATE VIEW v_sumas_y_saldos AS
SELECT c.id, c.codigo, c.nombre, c.naturaleza,
       SUM(r.debe)  AS suma_debe,
       SUM(r.haber) AS suma_haber,
       CASE WHEN c.naturaleza IN ('ACTIVO','EGRESO')
            THEN SUM(r.debe) - SUM(r.haber)
            ELSE SUM(r.haber) - SUM(r.debe) END AS saldo
FROM cuenta c
JOIN asiento_renglon r ON r.cuenta_id = c.id
JOIN asiento a ON a.id = r.asiento_id AND a.estado='CONTABILIZADO'
GROUP BY c.id;
```

### 7.4 Estados contables (Balance General y Estado de Resultados)

Se arman agrupando `v_sumas_y_saldos` por la jerarquía del plan de cuentas: Activo/Pasivo/PN al **Balance**; Ingreso/Egreso al **Estado de Resultados**. Recomendación: una tabla `mapeo_eecc` que asocie nodos del plan a rubros del balance (Activo Corriente, No Corriente, etc.) para que el armado sea configurable.

### 7.5 Subdiarios / cuentas corrientes

```sql
CREATE VIEW v_cta_cte_cliente AS
SELECT r.cliente_id, e.razon_social, a.fecha, a.glosa, r.debe, r.haber,
       SUM(r.debe - r.haber) OVER (PARTITION BY r.cliente_id
                                   ORDER BY a.fecha, a.numero) AS saldo
FROM asiento_renglon r
JOIN asiento a ON a.id=r.asiento_id AND a.estado='CONTABILIZADO'
JOIN entidad e ON e.id = r.cliente_id
WHERE r.cliente_id IS NOT NULL;
```

**Entregable de la Fase 7:** Diario, Mayor, Sumas y Saldos, cuentas corrientes y base de estados contables, todo desde una única fuente de verdad.

---

# FASE 8 — Cierres contables (mensual y de ejercicio)

### 8.1 Cierre de período (mensual)

Marcar `periodo.cerrado = true`. Los triggers de la Fase 2 ya impiden contabilizar en períodos cerrados. Se hace tras conciliar IVA, bancos y subdiarios.

### 8.2 Cierre de ejercicio

Tres pasos contables que tu sistema debe automatizar:

1. **Asientos de ajuste**: amortizaciones, devengamientos, provisiones, diferencias de cambio, previsiones.
2. **Refundición de cuentas de resultado**: un asiento que lleva a cero todas las cuentas de Ingreso/Egreso contra una cuenta "Resultado del Ejercicio". El resultado neto pasa al Patrimonio Neto.
3. **Asiento de cierre y de apertura**: cierra saldos del ejercicio y abre el siguiente con los saldos de las cuentas patrimoniales (Activo/Pasivo/PN).

```sql
-- Esqueleto: refundición de resultados al cierre
CREATE OR REPLACE FUNCTION refundir_resultados(p_ejercicio_id BIGINT, p_cuenta_resultado BIGINT)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_asiento BIGINT; v_periodo BIGINT;
BEGIN
    SELECT id INTO v_periodo FROM periodo
     WHERE ejercicio_id=p_ejercicio_id AND tipo='CIERRE' LIMIT 1;

    INSERT INTO asiento(empresa_id,periodo_id,fecha,glosa,estado,origen_tipo)
    SELECT empresa_id, v_periodo, fecha_fin, 'Refundición de cuentas de resultado','BORRADOR','CIERRE'
    FROM ejercicio WHERE id=p_ejercicio_id RETURNING id INTO v_asiento;

    -- lleva a cero cada cuenta de resultado (invierte su saldo) contra la cuenta resultado
    INSERT INTO asiento_renglon(asiento_id,cuenta_id,debe,haber)
    SELECT v_asiento, ss.id,
           CASE WHEN ss.saldo < 0 THEN -ss.saldo ELSE 0 END,  -- revierte
           CASE WHEN ss.saldo > 0 THEN  ss.saldo ELSE 0 END
    FROM v_sumas_y_saldos ss
    JOIN cuenta c ON c.id=ss.id
    WHERE c.naturaleza IN ('INGRESO','EGRESO') AND ss.saldo <> 0;

    -- contrapartida neta a la cuenta Resultado del Ejercicio
    INSERT INTO asiento_renglon(asiento_id,cuenta_id,debe,haber)
    SELECT v_asiento, p_cuenta_resultado,
           GREATEST(SUM(haber)-SUM(debe),0), GREATEST(SUM(debe)-SUM(haber),0)
    FROM asiento_renglon WHERE asiento_id=v_asiento;

    PERFORM contabilizar_asiento(v_asiento);
    RETURN v_asiento;
END $$;
```

### 8.3 Ajuste por inflación (RECPAM)

En Argentina los estados contables se reexpresan por inflación. Para soportarlo necesitás: el flag `cuenta.ajustable_inflacion` (Fase 1), índices de precios por período, y un proceso que calcule el **RECPAM** (resultado por exposición a la inflación) y genere el asiento de ajuste. Si recién empezás, dejá la estructura preparada (el flag y una tabla de índices) aunque el cálculo lo agregues después.

```sql
CREATE TABLE indice_inflacion (
    anio SMALLINT, mes SMALLINT, indice NUMERIC(18,6),
    PRIMARY KEY (anio, mes)
);
```

**Entregable de la Fase 8:** cierre mensual bloqueado, cierre de ejercicio con refundición/apertura automáticas y base para ajuste por inflación.

---

# Resumen: orden de implementación y dependencias

| Fase | Qué construís | Depende de | Lo usa el contador para |
|---|---|---|---|
| 0 | Tipos, multi-empresa, moneda, auditoría | — | (base técnica) |
| 1 | Plan de cuentas, ejercicios, asiento/renglón | 0 | Cargar asientos manuales |
| 2 | Motor: contabilizar, inmutabilidad, reversa | 1 | Confiar en que nada se rompe |
| 3 | Puente con módulos + reglas configurables | 1, 2 | Que todo se contabilice solo |
| 4 | IVA y Libros de IVA | 3 | Liquidar IVA |
| 5 | Retenciones y percepciones | 3 | Depositar y computar impuestos |
| 6 | Integración ARCA (CAE, LID) | 4, 5 | Facturar legal y presentar DDJJ |
| 7 | Diario, Mayor, Sumas y Saldos, EECC | 1–5 | Balances y libros |
| 8 | Cierres y ajuste por inflación | 7 | Cerrar el ejercicio |

## Checklist de validación (no des una fase por terminada sin esto)

- [ ] Ningún asiento se guarda con `SUM(debe) <> SUM(haber)`.
- [ ] Imposible imputar a cuenta no imputable o a período cerrado.
- [ ] Asiento contabilizado no se puede editar ni borrar (solo reversa).
- [ ] Numeración del Diario sin huecos por empresa.
- [ ] Todo asiento automático apunta a su comprobante (`origen_id`) y viceversa.
- [ ] IVA del subdiario concilia con el saldo de las cuentas de IVA del mayor.
- [ ] Retenciones practicadas = saldo de la cuenta "Retenciones a depositar".
- [ ] CAE obtenido en homologación antes de pasar a producción.
- [ ] Sumas y Saldos: total Debe = total Haber del sistema entero.
- [ ] Tras refundición, todas las cuentas de resultado quedan en cero.
```

