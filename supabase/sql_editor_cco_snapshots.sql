-- ══════════════════════════════════════════════════════════════
-- SQL Editor · Crear sistema de snapshots / restauración CCO
-- Pegar en Supabase → SQL Editor → Run
-- Luego: notify pgrst, 'reload schema';
-- Archivo fuente: supabase/migrations/275_cco_snapshots_restauracion.sql
-- ══════════════════════════════════════════════════════════════

create table if not exists public.cco_snapshots (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  label text,
  motivo text not null default 'manual'
    check (motivo in ('manual', 'diario', 'pre_restore', 'pre_import', 'pre_edit')),
  punto_en_tiempo timestamptz not null default now(),
  creado_por text,
  resumen jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  bytes_aprox integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_cco_snapshots_proyecto_punto
  on public.cco_snapshots (proyecto_id, punto_en_tiempo desc);

create index if not exists idx_cco_snapshots_proyecto_motivo
  on public.cco_snapshots (proyecto_id, motivo, created_at desc);

comment on table public.cco_snapshots is
  'Puntos de restauración del libro CCO por obra (config, contratos, presupuestos, ingresos, gastos obra). No incluye stock.';

alter table public.cco_snapshots enable row level security;

drop policy if exists "cco_snapshots_all_anon" on public.cco_snapshots;
create policy "cco_snapshots_all_anon" on public.cco_snapshots
  for all to anon using (true) with check (true);

drop policy if exists "cco_snapshots_all_auth" on public.cco_snapshots;
create policy "cco_snapshots_all_auth" on public.cco_snapshots
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.cco_snapshots to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- Verificación rápida:
-- select to_regclass('public.cco_snapshots') as tabla;
