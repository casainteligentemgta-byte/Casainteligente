# Productos: importar la lista de precios del proveedor

Pantalla **Productos → «Importar lista de precios del proveedor»** (`/productos/importar-lista`).
Pone al día el costo, la disponibilidad y la foto de los productos a partir de la lista mensual del proveedor, y permite agregar los que falten.

## Regla que no se puede romper: los precios no van al repositorio

Este repositorio es **público** y la lista trae los precios de costo.

- No subas a git la lista (PDF o CSV), las fotos, ni ningún `.sql`, `.json`, seed, test o captura con precios reales.
- En octubre de 2026 llegaron a estar en el repositorio tres listas (JSON y SQL) y una pantalla «Cargar catálogos 2026» que las llevaba dentro del código del sitio. Se retiraron; `lib/supabase/sinListasDePreciosEnRepo.test.ts` falla si vuelve a entrar algo parecido. Siguen en el historial de git mientras el repositorio sea público.
- No pegues precios en commits, PR ni comentarios.
- En las pruebas, datos inventados (`MOD-PRUEBA-100` a `12.34`).

La lista la sube el dueño desde la pantalla, con su sesión. El archivo se lee en el navegador y no se guarda en ningún sitio; solo se escriben los cambios que él marca.

## Cómo se usa

1. **Sube la lista**: el **PDF** del proveedor o un `.csv`. Si quiere fotos, el `.zip`. Indica la fecha de la lista y, si el PDF no trae la marca, puede escribirla.
2. **Cómo aplicar:**
   - «Mantener mi margen» (apagado por defecto): para los productos con ganancia propia, mueve el precio de venta en la misma proporción que el costo. Apagado, su precio no se toca. Los productos cuyo precio es igual al costo (o no tienen precio) **siempre** siguen al costo.
   - «Poner la foto de la lista a los que no tienen» (encendido si hay ZIP). Las fotos propias se respetan salvo que marque «Reemplazar también…».
3. **Revisa y marca.** La vista previa separa:
   - **Cambian de costo:** marcados.
   - **Hay que elegir:** el modelo se parece pero no es idéntico, o la lista lo trae con dos precios. No se tocan hasta que elija una opción.
   - **El proveedor no lo tiene:** el costo queda igual; solo se anota la disponibilidad.
   - **Sin cambio de costo:** se anota la disponibilidad.
   - **No los tienes en tu catálogo:** sin marcar; con buscador, filtro por sección y «Solo disponibles». «Marcar los N a la vista» marca de una vez todo lo filtrado (toda la lista, si se quitan los filtros). Se crean con el precio igual al costo.
4. **Aplicar** pide confirmación, guarda de cuatro en cuatro y muestra un resumen con lo que no se pudo. Con listas grandes tarda unos minutos y pide a la pantalla que no se apague; si se interrumpe, basta volver a subir la lista: lo ya guardado no se repite.

## Lista en PDF

El PDF se lee en el navegador de quien lo sube (no se envía a ningún servidor) y pasa por la misma revisión que el CSV. Cómo se interpreta:

- **Con encabezado** (lo normal): se busca la línea de títulos de la tabla (modelo / código / SKU, precio / USD / costo, descripción, estatus, marca) y cada celda se reparte en su columna por posición. Si hay varias columnas de precio, se toma la de instalador / distribuidor / costo antes que la de PVP o precio sugerido. La pantalla dice de qué columna salió el precio.
- **Descripciones de varias líneas:** se pegan a su renglón, tanto si la tabla está alineada arriba como si viene de Excel con el modelo centrado en vertical.
- **Hoja de Excel impresa a PDF:** las columnas se miden sobre los datos y no sobre los títulos (un título centrado sobre un texto alineado a la izquierda no confunde); un título que solo dice «INSTALADOR», «DISTRIBUIDOR» o «MAYORISTA» vale como columna de precio; los números de fila que Excel imprime a la izquierda se descartan; el modelo partido en dos o tres líneas se vuelve a unir; el estatus partido («NO» / «DISPONIBLE») también; un renglón con estatus y sin precio se lee como producto sin precio; el rótulo grande de la marca que Excel repite en cada hoja no se mezcla con las descripciones.
- **Fotos del PDF:** si la lista trae la foto de cada producto, se saca sola (sin ZIP). Se mira dónde está cada imagen de la página y se le da al renglón que tiene a su altura; una foto guardada en tiras o hecha con dos imágenes (un kit, la etiqueta «NEW») sale como una sola. Se arma en el navegador con las imágenes del propio PDF, sobre fondo blanco, y solo se sube a Supabase al aplicar, a los productos marcados (igual que las del ZIP: por defecto solo a los que no tienen foto). Lógica en `lib/productos/fotosListaPdf.ts`.
- **Títulos de sección** («CÁMARAS IP»): se guardan como sección de los renglones de abajo y sirven para sugerir la categoría.
- **Sin encabezado:** de cada línea se toma lo que parece un modelo y el último precio; la pantalla lo avisa.
- **Estatus:** «Disponible», «En stock», una cantidad mayor que cero → disponible; «Agotado», «Sin stock», «No disponible», 0 → no disponible; «En tránsito», «Próximamente» → en tránsito. Sin columna de estatus, lo que tiene precio se toma como disponible.
- **PDF escaneado** (una foto, sin texto): no se puede leer; hay que pedir el PDF original o la lista en Excel.

Cada proveedor arma su PDF a su manera. Si una lista se lee mal (modelos pegados a la descripción, precios de otra columna), no se aplica nada: se ajusta `lib/productos/leerListaPdf.ts` con ese caso y una prueba con datos inventados.

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
- **Productos nuevos:** `modelo` completo, `nombre` recortado de la descripción, categoría sugerida por la sección (editable), `cantidad` 0, precio igual al costo (utilidad 0).
- **Precio igual al costo:** si un producto tenía el precio igual al costo, o no tenía precio, al cambiar el costo el precio lo sigue. El margen se pone al armar cada presupuesto.

## Dónde está

- `lib/productos/importarListaPrecios.ts`: lectura del CSV, cruce y cálculo de cambios (pura, con pruebas).
- `lib/productos/leerListaPdf.ts`: de los trozos de texto del PDF a renglones de la lista (pura, con pruebas). `lib/productos/extraerTextoPdf.ts`: saca esos trozos con pdf.js en el navegador.
- `lib/productos/leerZip.ts`: lector de ZIP para el navegador, sin librerías (con pruebas).
- `components/productos/ImportarListaPrecios.tsx` y `app/productos/importar-lista/page.tsx`: la pantalla.
- `supabase/migrations/332_products_disponibilidad_proveedor.sql`: columnas `disponibilidad_proveedor` y `lista_proveedor_fecha` en `products`.
- En el catálogo (`app/productos/page.tsx`) aparece la etiqueta «Proveedor: no disponible» o «en tránsito».

Pruebas: `tsx --test lib/productos/*.test.ts`.


## Precio del catálogo y margen del presupuesto

El **precio** guardado en cada producto es la base. Al armar un presupuesto (`/ventas`) el
margen empieza en **0 %** y el operador lo sube ahí mismo; el precio de cada renglón es
`precio × (1 + margen)`. Hasta octubre de 2026 el margen arrancaba en 20 %.

Ojo: en la mayoría de los productos cargados desde listas de distribuidor el precio es igual
al costo. Con margen 0 % esos renglones se venden al costo; el resumen del presupuesto
muestra la ganancia en rojo cuando no deja nada, y **al guardar** se avisa qué renglones
se venden al costo o por debajo (`lib/presupuesto/avisoMargen.ts`); el operador puede
corregir o guardar de todos modos.

## Fichas por corregir

En el catálogo, con «Todas» y sin búsqueda, aparece la fila **Por corregir** con los
productos sin precio, sin categoría o con el nombre repetido. Tocar una opción filtra la
lista para editarlos uno por uno.

## Categorías

- La lista de categorías sale de la tabla `product_categories` más las de base del código.
  Los nombres se comparan sin distinguir acentos ni mayúsculas.
- Cámaras: lo que **es** una cámara (o un kit con cámaras) va en «Cámaras IP» o «Cámaras
  Análogas» (Turbo HD, TVI, analógica). No van ahí los servicios («Reubicación de cámara»),
  los accesorios («soporte para cámara»), los grabadores ni los equipos de domótica que
  solo mencionan una cámara en su descripción (videoporteros, cerraduras, detectores).
- Para quitar una categoría: pasar antes sus productos a otra y borrar la fila en la tabla.
- **Subcategorías:** una categoría puede tener subcategorías (filas de `product_categories` con `parent_id`); el producto guarda la suya en `products.subcategoria`. CCTV trae de fábrica «Cámaras IP», «Cámaras Análogas», «Otros dispositivos» y «Accesorios». Se crean más desde Productos (elegir la categoría → «+ Subcategoría») o desde el formulario del producto («+ Nueva subcategoría…»). El mismo nombre puede existir en dos categorías.
- En Productos, al elegir una categoría aparece debajo la fila de subcategorías para filtrar; el presupuesto (modo botones) hace lo mismo. Al importar una lista, cada producto nuevo se puede poner en «Categoría › Subcategoría».
