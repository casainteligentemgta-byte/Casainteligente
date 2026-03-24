# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Casa Inteligente is a single **Next.js 14** (App Router) CRM/ERP web application for a Venezuelan security & home-automation company. It uses **Supabase** (hosted PostgreSQL + Auth) as its backend and has no local database or Docker setup.

### Running the app

- **Dev server:** `npm run dev` (port 3000)
- **Lint:** `npm run lint`
- **Build:** `npm run build` — note: the build currently fails due to pre-existing ESLint errors (`react/no-unescaped-entities` in several files). The dev server works fine regardless.

### Environment variables

Copy `.env.example` to `.env.local`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional: `GEMINI_API_KEY` (only for invoice OCR feature).

Without valid Supabase credentials, the app still starts and renders all pages. The `/admin/dashboard` (Centro de Comando) and Projects Kanban board use mock/hardcoded data. Other data-dependent pages (Clientes, Productos, Empleados, etc.) show empty states.

### ESLint configuration

The repo ships without an `.eslintrc.json`. Running `npm run lint` for the first time triggers an interactive prompt. The `.eslintrc.json` with `"extends": "next/core-web-vitals"` is created during environment setup to enable non-interactive linting.

### Key caveats

- No automated tests exist in this codebase (no test framework configured).
- The `scripts/` directory contains a one-off CSV migration script, not setup scripts.
- SQL files in `/workspace/sql/` and root are intended for the Supabase SQL Editor, not local execution.
- Temporary debug files (`tmp_*.mjs`) at the root are development artifacts and not part of the application.
