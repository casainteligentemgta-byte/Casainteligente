# Productos: importar la lista de precios del proveedor

Pantalla **Productos → «Importar lista de precios del proveedor»** (`/productos/importar-lista`).
Pone al día el costo, la disponibilidad y la foto de los productos a partir de la lista mensual del proveedor, y permite agregar los que falten.

## Regla que no se puede romper: los precios no van al repositorio

Este repositorio es **público** y la lista trae los precios de costo.

- No subas a git la lista (PDF o CSV), las fotos, ni ningún `.sql`, `.json`, seed, test o captura con precios reales.
- No pegues precios en commits, PR ni comentarios.
- En las pruebas, datos inventados (`MOD-PRUEBA-100` a `12.34`).

La lista la sube el dueño desde la pantalla, con su sesión. El archivo se lee en el navegador y no se guarda en ningún sitio; solo se escriben los cambios que él marca.

## Cómo se usa

1. **Sube la lista** (`.csv`) y, si quiere fotos, el `.zip`. Indica la fecha de la lista.
2. **Cómo aplicar:**
   - «Mantener mi margen» (apagado por defecto): mueve el precio de venta en la misma proporción que el costo. Apagado, el precio de venta no se toca.
   - «Poner la foto de la lista a los que no tienen» (encendido si hay ZIP). Las fotos propias se respetan salvo que marque «Reemplazar también…».
3. **Revisa y marca.** La vista previa separa:
   - **Cambian de costo:** marcados.
   - **Hay que elegir:** el modelo se parece pero no es idéntico, o la lista lo trae con dos precios. No se tocan hasta que elija una opción.
   - **El proveedor no lo tiene:** el costo queda igual; solo se anota la disponibilidad.
   - **Sin cambio de costo:** se anota la disponibilidad.
   - **No los tienes en tu catálogo:** sin marcar; con buscador, filtro por sección y «Solo disponibles». «Marcar los N a la vista» marca de una vez todo lo filtrado (toda la lista, si se quitan los filtros). Se crean sin precio de venta.
4. **Aplicar** pide confirmación, guarda de cuatro en cuatro y muestra un resumen con lo que no se pudo. Con listas grandes tarda unos minutos y pide a la pantalla que no se apague; si se interrumpe, basta volver a subir la lista: lo ya guardado no se repite.

## Formato del CSV

UTF-8, separado por comas o punto y coma. Columnas (el orden no importa):

| Columna | Qué trae |
| --- | --- |
| `modelo` | **Obligatoria.** El modelo tal como lo escribe el proveedor (puede llevar el lente). |
| `precio_usd` | **Obligatoria.** Dólares; vacío o `-` si no hay precio. Acepta `10.25`, `10,25`, `1,825.00`. |
| `estatus` | `disponible`, `no_disponible` o `en_transito`. Sin esta columna, lo que tiene precio se toma como disponible. |
| `codigo` | Código de fábrica. Si falta, es la primera palabra de `modelo`. |
| `marca`, `seccion`, `descripcion` | Para productos nuevos y para sugerir la categoría. |
| `foto` | Nombre del archivo dentro del ZIP. Varias filas pueden compartir la misma. |
| `n`, `pagina`, `nota` | Informativas. |

## Reglas

- **Cruce:** se compara solo con letras y números en mayúsculas (`DS-2CE76K0T-LPFS` → `DS2CE76K0TLPFS`). Primero el modelo completo, luego el código. Coincidencia parcial (uno empieza por el otro, 8 caracteres o más) va a «Hay que elegir».
- **No se cruzan** los productos sin modelo ni con modelos de menos de 5 caracteres (servicios, mano de obra).
- **Costo:** solo se usa el precio si el estatus es `disponible` o `en_transito`. Un `no_disponible` nunca cambia el costo, aunque traiga precio.
- **Utilidad:** siempre `precio − costo`, como en el formulario de producto.
- **Fotos:** se suben con `uploadProductImage` (`lib/supabase/product-media.ts`) y la dirección va a `imagen`. Una misma foto se sube una sola vez por importación.
- **Productos nuevos:** `modelo` completo, `nombre` recortado de la descripción, categoría sugerida por la sección (editable), `cantidad` 0, sin precio de venta.

## Dónde está

- `lib/productos/importarListaPrecios.ts`: lectura del CSV, cruce y cálculo de cambios (pura, con pruebas).
- `lib/productos/leerZip.ts`: lector de ZIP para el navegador, sin librerías (con pruebas).
- `components/productos/ImportarListaPrecios.tsx` y `app/productos/importar-lista/page.tsx`: la pantalla.
- `supabase/migrations/332_products_disponibilidad_proveedor.sql`: columnas `disponibilidad_proveedor` y `lista_proveedor_fecha` en `products`.
- En el catálogo (`app/productos/page.tsx`) aparece la etiqueta «Proveedor: no disponible» o «en tránsito».

Pruebas: `tsx --test lib/productos/*.test.ts`.
