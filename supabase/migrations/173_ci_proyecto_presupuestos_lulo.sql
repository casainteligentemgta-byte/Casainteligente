-- Varios presupuestos Lulo (obras / CodObr) por proyecto del módulo integral.

create table if not exists public.ci_proyecto_presupuestos_lulo (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  codigo_obr text not null,
  nombre text not null default 'Presupuesto principal',
  es_principal boolean not null default false,
  orden int not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_proyecto_presupuestos_lulo_codigo_unique unique (proyecto_id, codigo_obr)
);

create index if not exists idx_ci_presupuesto_lulo_proyecto
  on public.ci_proyecto_presupuestos_lulo (proyecto_id);

create unique index if not exists idx_ci_presupuesto_lulo_un_principal
  on public.ci_proyecto_presupuestos_lulo (proyecto_id)
  where es_principal = true;

comment on table public.ci_proyecto_presupuestos_lulo is
  'Presupuestos LuloWin por proyecto (CodObr). Permite obra principal y ampliaciones.';

alter table public.capitulos
  add column if not exists presupuesto_lulo_id uuid references public.ci_proyecto_presupuestos_lulo (id) on delete cascade;

create index if not exists idx_capitulos_presupuesto_lulo
  on public.capitulos (presupuesto_lulo_id);

alter table public.ci_presupuesto_partidas
  add column if not exists presupuesto_lulo_id uuid references public.ci_proyecto_presupuestos_lulo (id) on delete cascade;

create index if not exists idx_ci_presupuesto_partidas_presupuesto_lulo
  on public.ci_presupuesto_partidas (presupuesto_lulo_id);

alter table public.ci_proyecto_presupuestos_lulo enable row level security;

drop policy if exists "ci_presupuesto_lulo_all_anon" on public.ci_proyecto_presupuestos_lulo;
create policy "ci_presupuesto_lulo_all_anon" on public.ci_proyecto_presupuestos_lulo
  for all to anon using (true) with check (true);

drop policy if exists "ci_presupuesto_lulo_all_authenticated" on public.ci_proyecto_presupuestos_lulo;
create policy "ci_presupuesto_lulo_all_authenticated" on public.ci_proyecto_presupuestos_lulo
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
