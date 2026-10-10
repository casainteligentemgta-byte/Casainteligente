# Flujo de compras, cuarentena y egresos de almacén

Documento de referencia para Casa Inteligente — ingreso y salida de material.

---

## Parte 1: Ingreso (compras → contabilidad → cuarentena → almacén)

### Tres formas de registrar una factura

| Vía | Ruta / canal | Origen en contabilidad |
|---|---|---|
| Telegram / WhatsApp | Bot → confirmación | `TELEGRAM` |
| Registro manual | `/almacen/procurement` | `RECEPCION_MERCANCIA` |
| Confirmación contable | `/contabilidad/compras/telegram/[id]` | `TELEGRAM` |

Todas convergen en **`/contabilidad/compras`** (cuadro unificado) y en las tablas:

- `purchase_invoices` — documento maestro
- `contabilidad_compras` + `contabilidad_compra_lineas` — registro contable
- `purchase_details` + `quality_inspections` — cuarentena

### Dos momentos clave

1. **Al registrar / confirmar** → contabilidad ✅ · stock físico ❌ (cuarentena `PENDIENTE`)
2. **Al liberar cuarentena o fast-track** → stock en `inventario_stock` ✅ · contabilidad marca `ingresado_almacen_at`

### Cuarentena

- **Todas** las compras pasan por cuarentena al registrarse.
- **Fast-track** (monto &lt; `limite_fast_track_usd` del proyecto, OCR &gt; 95 %, SKUs resueltos): auto-aprueba e ingresa stock.
- **Liberación manual:** `/almacen/procurement/quality`, `/liberar` en Telegram, o **Ingreso a almacén** en contabilidad.

### Dónde termina el material ingresado

`inventario_stock` en la **ubicación destino** (`ubicacion_destino_id`) + ledger `inv_movimientos` (`ingreso_compra`).

---

## Parte 2: Egreso (almacén → obra / obrero)

### Comando Telegram `/salida`

Menú unificado (misma idea que `/ingreso`). Tres tipos; todos descuentan stock al confirmar.

| Opción | Flujo | Persistencia |
|---|---|---|
| **A un obrero en obra** | obra → almacén → quién recibe → material/cantidad → partida → Gantt → foto | `transferencias_inventario` + `inv_egresos_campo` |
| **Despacho a obra u otro almacén** | paridad con `/almacen/despacho` (capítulo, partida, destino) | `registrarDespachoWeb` |
| **Traspaso / préstamo** | origen → destino → material → cantidad → nota → foto | `transferencias_inventario` (foto en `fotos`, migración **340**) |

#### Foto obligatoria

Todo movimiento registrado por el bot lleva foto: recepción en almacén (`/ingreso`), las tres
salidas (`/salida`) y la factura que carga el comprador (`/facturas` manual). El bot no ofrece
«Omitir» y no registra el movimiento hasta recibirla.

- Regla en un solo lugar: `lib/telegram/fotoObligatoria.ts`.
- Válvula de emergencia: `TELEGRAM_FOTO_OPCIONAL=1` vuelve a permitir omitirla (requiere redeploy).
- En el ingreso manual la foto por línea sigue siendo opcional; basta una foto del ingreso
  (general o de alguna línea).
- El despacho y la recepción hechos desde la web no cambian con esta regla.

#### A un obrero en obra (migración **206**)

1. Elegir **obra**
2. Elegir **almacén origen** (central o móvil)
3. Elegir **obrero** (`ci_empleados` del proyecto) o **escribir nombre y apellido** (texto libre; oficio opcional tras coma)
4. Por cada material (puede repetir varios productos):
   - Material con stock disponible
   - **Cantidad**
   - **Partida presupuestaria** (solo las que usan ese material en APU / `obra_partidas_materiales`)
   - **Actividad Gantt** (`cronograma_tareas` vinculada a la partida) o omitir
5. ¿Agregar otro material? Sí / No
6. **Foto del material** (obligatoria)
7. **Observaciones** (opcional; `-` para omitir)
8. Confirmar → descuenta stock y registra trazabilidad

### Datos que se guardan

**Cabecera** `inv_egresos_campo`:

| Campo | Descripción |
|---|---|
| obrero_nombre / obrero_empleado_id / obrero_oficio | Quién recibe |
| fecha_egreso / hora_egreso | Caracas |
| observaciones | Notas del depositario |
| foto_storage_path | Opcional |
| transferencia_id | Vínculo logístico |
| stock_aplicado | true si hubo descuento |

**Líneas** `inv_egresos_campo_lineas`:

| Campo | Descripción |
|---|---|
| material_id, cantidad, unidad | Producto |
| ci_presupuesto_partida_id, partida_label | Actividad presupuesto |
| cronograma_tarea_id, tarea_label | Actividad cronograma |
| transferencia_linea_id | Trazabilidad stock |

### Impacto en inventario

- `transferencias_inventario` tipo `salida_obra`
- `detalle_transferencia_partidas` — imputación por partida
- `inventario_stock` — descuento origen, entrada ubicación obra
- `inv_movimientos` — ledger `salida_obra`

### Consulta API

`GET /api/almacen/egresos-campo?proyecto_id=...&limit=50`

### Despacho web (alternativa)

`/almacen/despacho` — mismo modelo de transferencias e imputación por partida; el flujo Telegram añade obrero, tarea Gantt y trazabilidad en `inv_egresos_campo`.

---

## Migraciones relevantes

| # | Contenido |
|---|---|
| 180 | Stock, transferencias, partidas despacho |
| 203 | Ledger `inv_movimientos` |
| 206 | Trazabilidad egresos campo (`inv_egresos_campo`) |
| 340 | Foto en traspasos (`transferencias_inventario.fotos`) |

---

## Diagrama egreso Telegram

```mermaid
flowchart TD
    A[/salida] --> MNU{Tipo}
    MNU -->|Obrero en obra| B[Obra]
    B --> C[Almacén origen]
    C --> D[Obrero ci_empleados o texto]
    D --> E[Material + cantidad]
    E --> F[Partida APU]
    F --> G[Tarea Gantt opcional]
    G --> H{¿Más materiales?}
    H -->|Sí| E
    H -->|No| I[Foto obligatoria]
    I --> J[Observaciones]
    J --> K[Confirmar]
    K --> L[transferencias_inventario + inv_egresos_campo]
    L --> ST[inventario_stock actualizado]
    MNU -->|Despacho| DES[registrarDespachoWeb]
    DES --> ST
    MNU -->|Traspaso| TRF[Foto obligatoria]
    TRF --> TR[transferencias_inventario]
    TR --> ST
```
