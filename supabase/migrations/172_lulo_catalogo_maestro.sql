-- Catálogo maestro Lulo (ObraCapi, ObraMate/Mano/Equi, ObraPart, ObraPain*).
-- Equivalente al diseño capitulos / insumos / partidas / partida_insumos,
-- sin colisionar con public.capitulos y public.partidas de presupuesto por obra (migr. 164).

do $$
begin
  create type public.tipo_insumo as enum ('Material', 'ManoDeObra', 'Equipo');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.lulo_catalogo_capitulos (
  id uuid primary key default gen_random_uuid(),
  num_cap int not null,
  descripcion text not null,
  created_at timestamptz not null default now(),
  constraint lulo_catalogo_capitulos_num_cap_unique unique (num_cap)
);

comment on table public.lulo_catalogo_capitulos is
  'Capítulos Lulo (ObraCapi / ObraCapiDesc). Orden secuencial con num_cap.';

create table if not exists public.lulo_catalogo_insumos (
  codigo text primary key,
  descripcion text not null,
  unidad text not null,
  tipo public.tipo_insumo not null,
  precio_unitario numeric(12, 4) not null default 0,
  bono_diario numeric(12, 4) not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.lulo_catalogo_insumos is
  'Catálogo unificado ObraMate / ObraMano / ObraEqui.';

create table if not exists public.lulo_catalogo_partidas (
  id uuid primary key default gen_random_uuid(),
  codigo_lulo text not null,
  capitulo_id uuid references public.lulo_catalogo_capitulos (id) on delete set null,
  descripcion text not null,
  unidad text not null default 'UND',
  cantidad numeric(12, 2) not null default 0,
  rendimiento numeric(12, 4) not null default 1,
  created_at timestamptz not null default now(),
  constraint lulo_catalogo_partidas_codigo_lulo_unique unique (codigo_lulo)
);

comment on table public.lulo_catalogo_partidas is
  'Catálogo de partidas Lulo (ObraPart). Presupuesto por obra sigue en public.partidas (migr. 164).';

create table if not exists public.lulo_catalogo_partida_insumos (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.lulo_catalogo_partidas (id) on delete cascade,
  insumo_codigo text not null references public.lulo_catalogo_insumos (codigo) on delete restrict,
  cantidad_diseno numeric(12, 6) not null default 0,
  es_auto_porcentaje boolean not null default false,
  created_at timestamptz not null default now(),
  constraint lulo_catalogo_partida_insumo_unique unique (partida_id, insumo_codigo)
);

comment on table public.lulo_catalogo_partida_insumos is
  'APU de diseño (ObraPainMate / ObraPainMano / ObraPainEqui).';

create index if not exists idx_lulo_catalogo_partidas_capitulo
  on public.lulo_catalogo_partidas (capitulo_id);

create index if not exists idx_lulo_catalogo_partida_insumos_partida
  on public.lulo_catalogo_partida_insumos (partida_id);

create index if not exists idx_lulo_catalogo_partida_insumos_insumo
  on public.lulo_catalogo_partida_insumos (insumo_codigo);

-- RLS (mismo patrón que migr. 164)
alter table public.lulo_catalogo_capitulos enable row level security;
alter table public.lulo_catalogo_insumos enable row level security;
alter table public.lulo_catalogo_partidas enable row level security;
alter table public.lulo_catalogo_partida_insumos enable row level security;

drop policy if exists "lulo_catalogo_capitulos_all_anon" on public.lulo_catalogo_capitulos;
create policy "lulo_catalogo_capitulos_all_anon" on public.lulo_catalogo_capitulos
  for all to anon using (true) with check (true);

drop policy if exists "lulo_catalogo_capitulos_all_authenticated" on public.lulo_catalogo_capitulos;
create policy "lulo_catalogo_capitulos_all_authenticated" on public.lulo_catalogo_capitulos
  for all to authenticated using (true) with check (true);

drop policy if exists "lulo_catalogo_insumos_all_anon" on public.lulo_catalogo_insumos;
create policy "lulo_catalogo_insumos_all_anon" on public.lulo_catalogo_insumos
  for all to anon using (true) with check (true);

drop policy if exists "lulo_catalogo_insumos_all_authenticated" on public.lulo_catalogo_insumos;
create policy "lulo_catalogo_insumos_all_authenticated" on public.lulo_catalogo_insumos
  for all to authenticated using (true) with check (true);

drop policy if exists "lulo_catalogo_partidas_all_anon" on public.lulo_catalogo_partidas;
create policy "lulo_catalogo_partidas_all_anon" on public.lulo_catalogo_partidas
  for all to anon using (true) with check (true);

drop policy if exists "lulo_catalogo_partidas_all_authenticated" on public.lulo_catalogo_partidas;
create policy "lulo_catalogo_partidas_all_authenticated" on public.lulo_catalogo_partidas
  for all to authenticated using (true) with check (true);

drop policy if exists "lulo_catalogo_partida_insumos_all_anon" on public.lulo_catalogo_partida_insumos;
create policy "lulo_catalogo_partida_insumos_all_anon" on public.lulo_catalogo_partida_insumos
  for all to anon using (true) with check (true);

drop policy if exists "lulo_catalogo_partida_insumos_all_authenticated" on public.lulo_catalogo_partida_insumos;
create policy "lulo_catalogo_partida_insumos_all_authenticated" on public.lulo_catalogo_partida_insumos
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
