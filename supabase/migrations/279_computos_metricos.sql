-- Cómputos métricos vinculados a gastos/capítulos del CCO.

create table if not exists public.computos_metricos (
  id bigserial primary key,
  gasto_id bigint null references public.registros_gastos (id) on delete set null,
  capitulo text not null default '',
  subcapitulo text null,
  partida_codigo text null,
  descripcion_elemento text not null default '',
  ubicacion text null,
  cantidad numeric not null default 1,
  largo numeric not null default 0,
  ancho numeric not null default 0,
  alto_profundidad numeric not null default 0,
  unidad_medida text not null default 'm2',
  formula_expresion text null,
  total_computado numeric not null default 0,
  soporte_url text null,
  observaciones text null,
  created_at timestamptz not null default now()
);

create index if not exists computos_metricos_capitulo_idx
  on public.computos_metricos (capitulo);

create index if not exists computos_metricos_gasto_id_idx
  on public.computos_metricos (gasto_id);

alter table public.computos_metricos enable row level security;

drop policy if exists "computos_metricos_select_auth" on public.computos_metricos;
drop policy if exists "computos_metricos_insert_auth" on public.computos_metricos;
drop policy if exists "computos_metricos_update_auth" on public.computos_metricos;
drop policy if exists "computos_metricos_delete_auth" on public.computos_metricos;

create policy "computos_metricos_select_auth"
on public.computos_metricos for select to authenticated
using (true);

create policy "computos_metricos_insert_auth"
on public.computos_metricos for insert to authenticated
with check (true);

create policy "computos_metricos_update_auth"
on public.computos_metricos for update to authenticated
using (true)
with check (true);

create policy "computos_metricos_delete_auth"
on public.computos_metricos for delete to authenticated
using (true);

notify pgrst, 'reload schema';
