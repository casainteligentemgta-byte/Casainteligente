# Casa Inteligente

Proyecto para sistema de **casa inteligente** (domótica): control de dispositivos, sensores y automatizaciones.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (base de datos, auth, APIs)
- Deploy en **Vercel**; código en **GitHub**

## Cómo ejecutar

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar variables de entorno:
   ```bash
   cp .env.example .env.local
   ```
   Rellena en `.env.local` los valores de tu proyecto Supabase (Project URL y anon key).
3. Arrancar en desarrollo:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000).

Para producción: `npm run build` y `npm start`.

## Estado

Estructura Next.js lista. El agente de Cursor está configurado en `.cursor/rules/`.

## Ver la app en Vercel (GitHub + Supabase)

Para que la página se vea en Vercel con GitHub y Supabase configurados, sigue **en este orden** la guía (ahí está el paso a paso):

- **[docs/INTERCONEXION-CURSOR-VERCEL-GITHUB-SUPABASE.md](docs/INTERCONEXION-CURSOR-VERCEL-GITHUB-SUPABASE.md)** — sección *"Para ver la página en Vercel (orden recomendado)"*.

Importante: añade las variables **NEXT_PUBLIC_SUPABASE_URL** y **NEXT_PUBLIC_SUPABASE_ANON_KEY** en Vercel **antes** del primer Deploy, para que el build no falle.

## Estructura relevante

- `app/` — App Router: `layout.tsx`, `page.tsx`, `dispositivos/page.tsx`
- `lib/supabase/` — Cliente Supabase para navegador (`client.ts`) y servidor (`server.ts`)
- Variables de entorno en `.env.local` (ver `.env.example`)

## Próximos pasos

1. **Crear la tabla en Supabase**: en el SQL Editor de tu proyecto, ejecuta el contenido de `supabase/migrations/001_dispositivos.sql`. La página **Dispositivos** ya está conectada y listará los datos.
2. Añadir autenticación (Supabase Auth) si hace falta.
3. Habitaciones, automatizaciones o protocolos (Wi‑Fi, MQTT, etc.).

Abre este proyecto en Cursor y pide al agente que te guíe con el desarrollo.
