# Nexus Home — ERP/CRM domótica de lujo

## Acceso

- **URL:** `/nexus` (shell propio; oculta la barra inferior del CRM clásico).
- **Stack:** Next.js App Router, Tailwind, Radix UI, Framer Motion, Drizzle ORM + PostgreSQL.

## Relación con CRM construcción (`customers`)

**Decisión producto (Fase 3):** puente futuro `nexus_clients` → `customers`. **No implementado aún.**

| Capa | Tabla / ruta | Uso hoy |
|------|----------------|---------|
| **Operativo construcción** | `customers` · `/clientes` | Obras, compras, Telegram, presupuestos reales |
| **Nexus domótica** | `nexus_clients` · `/nexus/clientes` | Demo / vertical smart home; **aislado** de contabilidad |

Nexus **no** alimenta `contabilidad_compras`, `ci_proyectos` ni recepción en campo. Si buscas el cliente de una obra (ej. Flamboyant / DIMAQUINAS), usa **`/clientes`**, no Nexus.

### Puente planificado (fuera de alcance actual)

Objetivo: al crear o actualizar un registro en `nexus_clients`, poder **vincular o replicar** en `customers` para unificar directorio comercial sin perder el módulo Nexus.

**Mapeo de campos propuesto:**

| `nexus_clients` | `customers` |
|-----------------|-------------|
| `type = person` | `customer_type = natural` |
| `type = organization` | `customer_type = juridico` · `razon_social` |
| `display_name` | `nombre` / `razon_social` (según tipo) |
| `email` | `email` |
| `phone` | `telefono` / `movil` |
| `tax_id` | `rif` (normalizar prefijo V/J/E) |
| `notes` | metadata futura o campo libre |

**Cambios de esquema sugeridos (cuando se implemente):**

- Columna `nexus_clients.customer_id uuid references customers(id)` (nullable, único).
- Índice por `tax_id` / `email` para deduplicar antes de insertar en `customers`.
- Script one-shot `scripts/sync-nexus-clients-to-customers.mjs` (modo dry-run + apply).
- Helper de mapeo (sin sync): `lib/nexus/puenteCustomersFuturo.ts`.
- RLS en `nexus_*` alineada con `authenticated`.

**Fuera de alcance de la Fase 3:** sync automático, webhooks, unificación de `nexus_proposals` con `budgets`, ni borrado de tablas `nexus_*`.

**CRM canónico hasta entonces:** solo `customers` + `ci_proyectos.customer_id`.

## Marca visual (Neon-Glass)

- Variables CSS en `app/globals.css`: `--nexus-bg-base`, `--nexus-cyan`, `--nexus-green`, `--nexus-gold`, `--color-primary-glow`.
- Tipografía: **Inter** (UI), **JetBrains Mono** (`--font-nexus-mono`) para precios, SKU y coordenadas (`components/nexus/Mono.tsx`).
- Superficies: `GlassCard`, `backdrop-blur-[20px]`, borde `rgba(255,255,255,0.1)`.

## Módulos

| Ruta | Descripción |
|------|-------------|
| `/nexus` | Panel y accesos |
| `/nexus/clientes` | Directorio + inmuebles (`nexus_client_properties`) |
| `/nexus/catalogo` | Catálogo maestro hardware/servicio |
| `/nexus/builder` | Nexus Builder (DnD + totales + margen) |
| `/nexus/proyectos` | Obra + timeline (demo) |
| `/nexus/contratos/demo/firmar` | Firma digital + animación isotipo |
| `/nexus/vision` | **NetVision Pro** — CCTV + redes + diagrama unifilar. Roadmap: cableado, normativas, BIM |

## Base de datos

1. Añade `DATABASE_URL` en `.env.local` (cadena PostgreSQL de Supabase u otro host).
2. Aplica esquema:
   - **Supabase SQL Editor:** `supabase/migrations/011_nexus_home_schema.sql`, o
   - **CLI:** `npm run db:push` (requiere `DATABASE_URL` en entorno).

Tablas con prefijo `nexus_*` para no chocar con `customers`, `budgets`, etc.

## PDF demo (propuesta)

`GET /api/nexus/proposals/demo/pdf` — HTML listo para imprimir / “Guardar como PDF”, branding oscuro + cian.

## Próximos pasos sugeridos

- **Puente `nexus_clients` → `customers`** (ver sección arriba; decisión Luis: opción C).
- Server Actions CRUD catálogo y clientes.
- Persistir líneas del Builder en `nexus_proposals` / `nexus_proposal_lines`.
- Tras firma, guardar en `nexus_signatures` y actualizar `nexus_proposals.status` → `contract_signed`.
- Políticas RLS en Supabase para `nexus_*` (hoy solo tablas; ajustar a `authenticated`).
