# Diseño del presupuesto — cómo se verá

Guía para cuando quieras **definir o cambiar** la apariencia del presupuesto (pantalla, impreso y PDF/HTML).

## Dónde vive hoy

| Vista | Ubicación |
|--------|-----------|
| **Pantalla (oscuro, tipo app)** | `/ventas/preview` — datos desde `localStorage` (`presupuesto_preview`) tras “Vista previa” en Ventas. |
| **Guardado en BD** | Tabla `budgets` (`items` JSON, `customer_name`, `subtotal`, etc.). |
| **HTML para imprimir / guardar** | `GET /api/budgets/[id]/pdf` — documento claro tipo **papel A4**. |

## Principios

1. **Pantalla ≠ papel**: en móvil/desktop el documento puede ser **oscuro y glass** (coherente con `globals.css`). En **impresión** conviene **fondo blanco** y contraste alto (tinta, escaneos, PDF).
2. **Jerarquía**: primero **quién emite** (marca + RIF), luego **número y fecha**, luego **cliente**, luego **tabla de ítems**, luego **totales** y **condiciones / pagos / notas**.
3. **Un solo lugar para marca**: constantes en `lib/presupuesto/brand.ts` (`PRESUPUESTO_BRAND`). Cambia nombre legal, RIF, Zelle y textos legales ahí.

## Estructura del documento (bloques)

```
┌─────────────────────────────────────────────┐
│ [Logo]  CASA INTELIGENTE, C.A.     Fecha   │
│         Tagline · RIF empresa      [Nro P-xx]│
├─────────────────────────────────────────────┤
│ CLIENTE (nombre destacado)     Total $      │
│ RIF · tel · email                           │
├─────────────────────────────────────────────┤
│ Descripción      Precio   Cant.   Subtotal  │
│ ...filas...                                 │
├─────────────────────────────────────────────┤
│ Condiciones · Zelle · Notas    │ Resumen   │
│                                │ subtotal  │
│                                │ TOTAL     │
└─────────────────────────────────────────────┘
```

## Tipografía

- **Pantalla**: `Inter` / sistema (ya cargado en `globals.css`).
- **Impresión**: `system-ui`, `Georgia` o una fuente web embebida si más adelante usas PDF real (ej. `@react-pdf/renderer`).

Tamaños sugeridos (impresión):

- Título empresa: **18–22 px**
- Nombre cliente: **20–24 px**
- Tabla cuerpo: **10–11 px**
- Total: **18–22 px** en negrita

## Colores (referencia)

- Acento app: `--ios-blue` `#007AFF`
- Total / éxito: `--ios-green` `#34C759`
- Impresión: ver `PRESUPUESTO_BRAND.impresion` (slate + azul corporativo)

## Próximos pasos de diseño (cuando quieras)

- [ ] Sustituir el icono genérico por **logo PNG/SVG** real (cabecera preview + API).
- [ ] Ajustar **condiciones** y **% de anticipo** según abogado/comercial.
- [ ] Segunda variante: **presupuesto “Nexus Home”** (nombre comercial distinto al legal).
- [ ] PDF binario con plantilla fija (Storage + enlace en `contratos` o email).

## Cómo probar en local

1. **Ejemplo sin datos reales**: con el dev server en marcha abre  
   **`http://localhost:3000/ventas/preview?demo=1`**  
   o **`http://localhost:3000/presupuesto/demo`** (redirige al mismo sitio).  
   Desde **Presupuestos** también hay el botón **“Ver diseño (demo)”**.
2. **Preview real**: Ventas → completar cliente e ítems → **Vista previa** → `/ventas/preview`.
3. **HTML guardado**: guardar un presupuesto → abrir `/api/budgets/<uuid>/pdf` → Imprimir / “Guardar como PDF”.
