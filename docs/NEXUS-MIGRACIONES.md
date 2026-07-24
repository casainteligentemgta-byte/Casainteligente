# Nexus Home — orden de migraciones Supabase

Ejecuta en **SQL Editor** (o `supabase db push` si usas CLI) **en este orden**:

| Orden | Archivo | Descripción |
|------|---------|-------------|
| 1 | `008_empresas.sql` | Tabla `empresas` (ventas en español + import 007). |
| 2 | `003_productos.sql` | Catálogo `productos` (UUID). |
| 3 | `004_ventas.sql` | `ventas` + `venta_items`. |
| 4 | `005_personas.sql` | `personas`. |
| 5 | `006_ventas_cliente_persona_o_empresa.sql` | XOR empresa/persona en ventas. |
| 6 | `009_customers_products_budgets_projects.sql` | CRM UI: `customers`, `products`, `budgets`, `projects`. |
| 7 | `010_nexus_contratos_firmas.sql` | `contratos` + firma/PDF por proyecto. |
| 8 | `007_importar_datos_legacy_clientes_productos.sql` | **Una vez**, si existen `tb_clientes` / `products` legacy. |

## Dos modelos en paralelo

- **Español**: `empresas`, `personas`, `productos`, `ventas` — formulario “Nueva venta” y dashboard que cuente estas tablas.
- **Inglés (presupuestos / Kanban)**: `customers`, `products`, `budgets`, `projects` — pantallas estilo CRM integradas con Vercel.

Puedes sincronizar datos entre ambos con scripts ETL cuando lo necesites.

## Mapa y PDF (siguientes pasos)

- `projects.lat` / `projects.lng` ya están en `009` para Leaflet/Mapbox.
- PDF branded: subir a **Storage** y guardar `pdf_storage_path` o `pdf_url` en `contratos`.
- Políticas RLS: las actuales usan `anon` para desarrollo; en producción sustituir por `authenticated` y roles.
