# Casa Inteligente APP - Security & Domotics Management

## Setup

1.  **Install Dependencies**: (Done)
    `npm install`

2.  **Environment Variables**:
    Copy `.env.example` to `.env.local` and fill in your Supabase details.
    
    ```bash
    cp .env.example .env.local
    ```

    Required variables:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3.  **Si la web no carga:** usa **http://127.0.0.1:3000** (no solo `localhost`) y lee **[docs/DEV-CUANDO-NO-CARGA.md](docs/DEV-CUANDO-NO-CARGA.md)**. Prueba **http://127.0.0.1:3000/api/health**.

4.  **Run Development Server**:
    
    ```bash
    npm run dev
    ```

    Abre **[http://127.0.0.1:3000](http://127.0.0.1:3000)** (recomendado en Windows).

## Features

- **Projects Dashboard**: Kanban board with drag-and-drop project management.
- **Budget ROI**: Real-time margin calculation on project cards.
- **Supabase Integration**: Server Actions for data fetching and updates.
- **UI**: Built with Tailwind CSS and Shadcn/UI components.

## Nexus Home (ERP/CRM lujo)

- Entrada: **`/nexus`** (también enlace “Nexus” en el dashboard principal).
- Documentación: **[docs/NEXUS-HOME.md](docs/NEXUS-HOME.md)** · migración SQL: `supabase/migrations/011_nexus_home_schema.sql`.
- ORM: Drizzle (`npm run db:push`, `db:studio`) con `DATABASE_URL` en `.env.local`.

## Base de datos (Supabase)

Orden y descripción de migraciones (incl. Nexus / CRM): ver **[docs/NEXUS-MIGRACIONES.md](docs/NEXUS-MIGRACIONES.md)**.

- **Fotos y manuales de productos:** lo más rápido es pegar en SQL Editor **`supabase/sql_editor_storage_fotos_productos.sql`** (crea **`product-media`** y **`productos`** + políticas anon/authenticated). Alternativa por migraciones: `012`, `018`, `019`. Opcional: `NEXT_PUBLIC_SUPABASE_PRODUCT_MEDIA_BUCKET` en `.env.local`.

- Presupuesto imprimible (HTML A4 claro): `GET /api/budgets/[id]/pdf`
- Guía visual del documento: **[docs/PRESUPUESTO-DISENO.md](docs/PRESUPUESTO-DISENO.md)** · marca en `lib/presupuesto/brand.ts`

## Structure

- `/app`: Next.js App Router pages and API actions.
- `/components`: UI components (Shadcn) and Dashboard features.
- `/lib`: Utilities and Supabase clients.
- `/types`: TypeScript interfaces.
