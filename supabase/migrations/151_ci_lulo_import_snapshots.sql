-- Copia completa de cada importación Lulo (MDB/CSV) por proyecto.

create table if not exists public.ci_lulo_import_snapshots (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  nombre_archivo text not null default '',
  formato text not null check (formato in ('mdb', 'csv')),
  resumen jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_lulo_snapshots_proyecto
  on public.ci_lulo_import_snapshots (proyecto_id, created_at desc);

comment on table public.ci_lulo_import_snapshots is
  'Respaldo JSON completo de archivos Lulo importados (todas las tablas/filas).';

alter table public.ci_lulo_import_snapshots enable row level security;

drop policy if exists "ci_lulo_snapshots_select_anon" on public.ci_lulo_import_snapshots;
drop policy if exists "ci_lulo_snapshots_insert_anon" on public.ci_lulo_import_snapshots;
drop policy if exists "ci_lulo_snapshots_update_anon" on public.ci_lulo_import_snapshots;
drop policy if exists "ci_lulo_snapshots_delete_anon" on public.ci_lulo_import_snapshots;

create policy "ci_lulo_snapshots_select_anon"
  on public.ci_lulo_import_snapshots for select to anon using (true);
create policy "ci_lulo_snapshots_insert_anon"
  on public.ci_lulo_import_snapshots for insert to anon with check (true);
create policy "ci_lulo_snapshots_update_anon"
  on public.ci_lulo_import_snapshots for update to anon using (true) with check (true);
create policy "ci_lulo_snapshots_delete_anon"
  on public.ci_lulo_import_snapshots for delete to anon using (true);

notify pgrst, 'reload schema';
