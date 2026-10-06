# Encargo para Cursor: actualizar Productos con la lista de precios del proveedor

**Pedido por:** el dueño (Casa Inteligente C.A.) · **Fecha:** 6 de octubre de 2026
**Lista:** «CCTV Septiembre 2026» del proveedor (PDF de 86 páginas).

## Qué se pide

Poner al día **Productos** (`/productos`, tabla `products`) con esa lista:

1. Actualizar el **costo** de los productos que ya existen y aparecen en la lista.
2. Guardar la **disponibilidad** que informa el proveedor.
3. Permitir **agregar** los productos de la lista que falten, solo los que el dueño elija.

## Regla que no se puede romper: los precios no van al repositorio

Este repositorio es **público**. La lista trae los precios de costo del proveedor.

- No subas a git el PDF, el CSV, ni ningún `.sql`, `.json`, seed, test o captura que contenga precios de la lista.
- No pegues precios en mensajes de commit, descripciones de PR ni comentarios.
- En los tests usa datos inventados (por ejemplo `MODELO-PRUEBA-1` a `12.34`).

El dueño tiene el archivo `Lista-precios-CCTV-Septiembre-2026.csv` (ya limpio, ver formato abajo) y te lo adjunta en el chat. Úsalo para probar en tu máquina y **bórralo antes de hacer commit**.

## Cómo hacerlo: un importador dentro de la app

La lista llega cada mes, así que la solución es una pantalla, no una migración con datos.

**«Importar lista de precios»** en `/productos` (solo con sesión; `/productos` ya exige sesión por `lib/supabase/rutasAcceso.ts` y la tabla `products` solo se lee y escribe con sesión desde la migración 329):

1. El dueño sube el CSV. Se lee en el navegador; no se guarda el archivo en ningún sitio.
2. **Vista previa** antes de tocar nada, en cuatro grupos:
   - **Cambian de costo:** producto, costo actual → costo nuevo, diferencia.
   - **Sin cambio:** ya tienen ese costo.
   - **Dudosos:** el modelo se parece pero no es idéntico; el dueño confirma uno por uno.
   - **Nuevos:** están en la lista y no en Productos; sin marcar por defecto.
3. El dueño marca lo que quiere y pulsa **Aplicar**. Al terminar, un resumen: cuántos se actualizaron, cuántos se crearon, cuántos se saltaron.

### Formato del CSV

UTF-8 con BOM, separado por comas, una fila por renglón de la lista (1.188 filas).

| Columna | Qué trae |
| --- | --- |
| `n` | Orden en la lista (1…1188). |
| `pagina` | Página del PDF, para verificar a ojo. |
| `seccion` | Título de la sección del PDF (57 secciones: «CAMARAS IP 4MP», «NVRs HIKVISION», «DISCOS DUROS»…). |
| `marca` | HIKVISION, HiLook, STC, SIEMON, CABLIX, UBIQUITI, SEAGATE, UTEPO, HIKMICRO, TENDA. |
| `codigo` | Primera palabra del modelo: el código de fábrica (`DS-2CD1327G2-LUF`). Úsalo para cruzar. |
| `modelo` | El modelo tal como lo escribe el proveedor; a veces lleva lente o aclaratorias (`DS-2CD1327G2-LUF 2.8MM`, `… MICROFONO`, `… INCLUYE BASE Y FUENTE`). |
| `descripcion` | Texto completo de la celda. |
| `precio_usd` | Precio de la lista en dólares, con punto decimal. **Vacío** si el proveedor no lo da. |
| `estatus` | `disponible`, `no_disponible` o `en_transito`. |
| `nota` | Avisos de la extracción (ver «Rarezas» abajo). Vacía en casi todas. |

### Cómo cruzar la lista con Productos

- Normaliza ambos lados igual: mayúsculas y solo letras y números (`DS-2CE76K0T-LPFS` → `DS2CE76K0TLPFS`). Ojo: algunos modelos guardados en `products` usan un guion raro (U+2010) o dobles guiones; la normalización los resuelve.
- **Coincidencia exacta** de `products.modelo` normalizado con `codigo` normalizado → va a «Cambian de costo» o «Sin cambio».
- **Coincidencia parcial** (uno empieza por el otro, con 8 caracteres o más) → va a «Dudosos». Ejemplos reales: el producto `DS-2CD1127G0L` frente a `DS-2CD1127G0-LUF` de la lista; el producto `STC-6PC1M` frente a `STC-6PC1M-B` y `STC-6PC1M-W` (azul y blanco).
- Si un código aparece varias veces en la lista con lentes distintos (`… 2.8MM`, `… 4MM`), muéstralos todos y que el dueño elija.
- No toques productos sin `modelo` (mano de obra, servicios, herrería) ni marcas que la lista no trae (EZVIZ, Aqara, Sonos…).

Como referencia: hoy hay 329 productos; unos 22 cruzan exacto y unos 10 quedan como dudosos. El resto no está en esta lista.

### Qué se escribe en `products`

- `costo` = `precio_usd`, **solo** si `estatus` es `disponible` o `en_transito` y hay precio.
- `modificado` = ahora.
- `precio` (venta) **no se cambia solo**. Ofrece una casilla, apagada por defecto, «Mantener mi margen»: recalcula `precio` para conservar el mismo porcentaje de margen que tenía el producto. `utilidad` se guarda siempre como `precio − costo` (así lo hace `components/productos/NuevoProductoForm.tsx`).
- Si `estatus` es `no_disponible`: no se toca el costo; solo se anota la disponibilidad.

### Disponibilidad (columnas nuevas)

`products` no tiene dónde guardarla. Agrega una migración (la siguiente libre después de `331_…`), solo de estructura:

- `disponibilidad_proveedor text` con valores `disponible`, `no_disponible`, `en_transito` o `null`.
- `costo_lista_fecha date`: de qué lista salió el costo (el dueño la indica al importar; por defecto, hoy).

Muéstrala en la ficha y en el listado de Productos (una etiqueta discreta). NetVision lee `products` con una lista fija de columnas en `lib/netvision/presupuestoCloud.ts`; si quieres avisar «no disponible» en el presupuesto, añade ahí la columna.

### Productos nuevos

- No crear en masa: la lista tiene 1.188 renglones y el catálogo 329.
- Al crear uno: `nombre` = descripción recortada a algo legible, `modelo` = `codigo`, `marca`, `descripcion` completa, `costo`, `cantidad` 0, y `precio` vacío para que el dueño lo fije.
- `categoria`: propón una a partir de `seccion` usando las categorías que ya existen (`lib/productos/categoriasCatalogo.ts`); que el dueño pueda cambiarla antes de aplicar.

## Rarezas de esta lista (ya marcadas en `nota`)

- **Dos filas «no disponible» traen precio 1.00 y 2.00** (relleno del proveedor). No usar ese precio. La regla de arriba ya lo cubre.
- **37 filas repetidas**: el mismo modelo sale en dos secciones. En 4 de ellas el precio o el estatus no coincide entre las dos apariciones; mándalas a «Dudosos».
- **4 filas con descripción compartida**: en el PDF varios modelos usan una sola celda de descripción.
- **Una fila `en_transito`**: tiene precio; trátala como disponible para el costo y guarda el estatus tal cual.

## Reglas del proyecto que aplican

- El build de producción compila a ES5 y corre el lint: nada de `[...set]` ni `for…of` sobre `Set`, `Map` o texto (usa `Array.from`); los hooks propios se llaman `use…`; comillas escapadas en JSX.
- Pon el cruce y las reglas en una función pura (por ejemplo `lib/productos/importarListaPrecios.ts`) con sus pruebas, como el resto de `lib/netvision/*.test.ts`.
- Todo en lenguaje llano y en español para el dueño.

## Cómo se preparó el CSV

Se leyó el PDF celda por celda (por las etiquetas de la tabla, no por posición del texto) y se comprobó contra una segunda lectura independiente: 1.055 filas comparadas, cero diferencias; el resto se revisó a mano. Totales: 1.188 filas, 745 disponibles, 442 no disponibles, 1 en tránsito; 748 con precio.
