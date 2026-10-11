# Nexus Home — ERP/CRM domótica de lujo

## Acceso

- **URL:** `/nexus` (shell propio; oculta la barra inferior del CRM clásico).
- **Stack:** Next.js App Router, Tailwind, Radix UI, Framer Motion, Drizzle ORM + PostgreSQL.

## Clientes: un solo directorio (`customers`)

Desde octubre de 2026 la aplicación tiene **un solo directorio de clientes**: la tabla
`customers`, en `/clientes`. El directorio propio de Nexus (`nexus_clients`, pantalla
`/nexus/clientes`) se retiró: nunca tuvo registros. El enlace antiguo lleva a `/clientes`,
igual que `/clientes/crm` y `/personas`.

Las tablas `nexus_clients` y `nexus_client_properties` siguen en la base, vacías, porque
otras tablas `nexus_*` (propuestas, proyectos de instalación) apuntan a ellas. No se usan.

## Marca visual (Neon-Glass)

- Variables CSS en `app/globals.css`: `--nexus-bg-base`, `--nexus-cyan`, `--nexus-green`, `--nexus-gold`, `--color-primary-glow`.
- Tipografía: **Inter** (UI), **JetBrains Mono** (`--font-nexus-mono`) para precios, SKU y coordenadas (`components/nexus/Mono.tsx`).
- Superficies: `GlassCard`, `backdrop-blur-[20px]`, borde `rgba(255,255,255,0.1)`.

## Módulos

| Ruta | Descripción |
|------|-------------|
| `/nexus` | Panel y accesos |
| `/clientes` | Directorio único de clientes (fuera del shell Nexus) |
| `/nexus/catalogo` | Catálogo maestro hardware/servicio |
| `/nexus/builder` | Nexus Builder (DnD + totales + margen) |
| `/nexus/proyectos` | Obra + timeline (demo) |
| `/nexus/contratos/demo/firmar` | Firma digital + animación isotipo |
| `/nexus/vision` | **NetVision Pro** — CCTV + redes + cableado + subterráneo + normas + BIM |

## Base de datos

1. Añade `DATABASE_URL` en `.env.local` (cadena PostgreSQL de Supabase u otro host).
2. Aplica esquema:
   - **Supabase SQL Editor:** `supabase/migrations/011_nexus_home_schema.sql`, o
   - **CLI:** `npm run db:push` (requiere `DATABASE_URL` en entorno).

Tablas con prefijo `nexus_*` para no chocar con `customers`, `budgets`, etc.

## PDF demo (propuesta)

`GET /api/nexus/proposals/demo/pdf` — HTML listo para imprimir / “Guardar como PDF”, branding oscuro + cian.

## Próximos pasos sugeridos

- Server Actions CRUD catálogo y clientes.
- Persistir líneas del Builder en `nexus_proposals` / `nexus_proposal_lines`.
- Tras firma, guardar en `nexus_signatures` y actualizar `nexus_proposals.status` → `contract_signed`.
- Políticas RLS en Supabase para `nexus_*` (hoy solo tablas; ajustar a `authenticated`).
