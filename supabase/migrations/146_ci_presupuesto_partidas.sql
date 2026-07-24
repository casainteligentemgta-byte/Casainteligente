-- Partidas de presupuesto por proyecto (importación desde Lulo u otros CSV).

create table if not exists public.ci_presupuesto_partidas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  codigo_partida text not null default '',
  descripcion text not null default '',
  unidad text not null default 'UND',
  cantidad_presupuestada numeric(15, 4) not null default 0,
  precio_unitario_estimado numeric(15, 4) not null default 0,
  monto_total_estimado numeric(15, 2) not null default 0,
  origen text not null default 'lulo_csv',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_presupuesto_partidas_proyecto
  on public.ci_presupuesto_partidas (proyecto_id);

create index if not exists idx_ci_presupuesto_partidas_codigo
  on public.ci_presupuesto_partidas (proyecto_id, codigo_partida);

comment on table public.ci_presupuesto_partidas is
  'Partidas de presupuesto de obra por proyecto (import Lulo CSV).';

alter table public.ci_presupuesto_partidas enable row level security;

drop policy if exists "ci_presupuesto_partidas_select_anon" on public.ci_presupuesto_partidas;
drop policy if exists "ci_presupuesto_partidas_insert_anon" on public.ci_presupuesto_partidas;
drop policy if exists "ci_presupuesto_partidas_update_anon" on public.ci_presupuesto_partidas;
drop policy if exists "ci_presupuesto_partidas_delete_anon" on public.ci_presupuesto_partidas;

create policy "ci_presupuesto_partidas_select_anon" on public.ci_presupuesto_partidas for select to anon using (true);
create policy "ci_presupuesto_partidas_insert_anon" on public.ci_presupuesto_partidas for insert to anon with check (true);
create policy "ci_presupuesto_partidas_update_anon" on public.ci_presupuesto_partidas for update to anon using (true) with check (true);
create policy "ci_presupuesto_partidas_delete_anon" on public.ci_presupuesto_partidas for delete to anon using (true);

notify pgrst, 'reload schema';
