# Productos: actualizar costos desde la web del proveedor

Pantalla: **Productos → «Actualizar costos desde la web del proveedor»** (`/productos/costos-proveedor`).

## Cómo se usa

1. En cada producto (Productos → Editar) se pega, en **«Enlace en la web del proveedor»**, la dirección de la página de ese producto en la tienda del proveedor. Ahí mismo, «Leer precio de la web» muestra el precio y «Usar como costo» lo pone en el formulario.
2. En **Costos del proveedor**, «Consultar precios» abre la página de cada producto con enlace, de uno en uno, y lee su precio.
3. Se muestra qué cambiaría: **Cambian de costo** (marcados), **No se pudo leer** (con el motivo) y **Sin cambios**. Nada se guarda hasta tocar «Aplicar».
4. Al aplicar se usan las mismas reglas que al importar una lista: el precio de venta sigue al costo si era igual al costo; si el producto tiene ganancia propia, su precio no se toca, salvo que se active «Mantener mi margen».

## Reglas

- **Solo proveedores admitidos.** La lista está en `lib/productos/precioProveedorWeb.ts` (`PROVEEDORES_WEB`). Hoy: `electronica.com.ve`. El servidor no abre ninguna otra dirección.
- **Solo páginas de producto.** Antes de admitir un proveedor se lee su `robots.txt`. El de electronica.com.ve no permite usar el buscador ni los filtros con un programa, pero sí visitar las páginas de producto: por eso el enlace se guarda por producto y no se «busca» en su web.
- **Sin prisa.** Una página por vez, con pausa entre una y otra.
- **Solo dólares.** Si la página declara otra moneda, no se toma el precio.
- **El precio se lee de las etiquetas de la tienda** (`product:price:amount`, datos estructurados), no adivinando cifras del texto.
- La ruta `POST /api/productos/precio-proveedor` pide sesión (como toda ruta de `/api`).

## Para añadir otro proveedor

1. Leer su `robots.txt` y sus condiciones de uso.
2. Añadirlo a `PROVEEDORES_WEB` con su dominio y la forma de sus páginas de producto.
3. Añadir pruebas en `lib/productos/precioProveedorWeb.test.ts` con páginas inventadas.

## Archivos

- `lib/productos/precioProveedorWeb.ts`: revisar el enlace, leer el precio de la página, consultar (pura, con pruebas).
- `app/api/productos/precio-proveedor/route.ts`: la consulta desde el servidor.
- `components/productos/CostosProveedorWeb.tsx`: la pantalla.
- `supabase/migrations/352_productos_enlace_proveedor.sql`: columna `products.proveedor_url`.
