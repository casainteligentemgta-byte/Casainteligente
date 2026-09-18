-- Categorías del catálogo comercial (products.categoria).
-- Permite crear tipos nuevos desde /productos y el formulario de producto.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'personalizada'
    check (kind in ('comercial', 'interna', 'personalizada')),
  sort_order integer not null default 500,
  color text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_product_categories_name_lower
  on public.product_categories (lower(trim(name)));

insert into public.product_categories (name, kind, sort_order, color)
select v.name, v.kind, v.sort_order, v.color
from (
  values
    ('Cámaras IP', 'comercial', 10, '#007AFF'),
    ('Cámaras Análogas', 'comercial', 20, '#5856D6'),
    ('C.C.T.V', 'comercial', 30, '#5856D6'),
    ('Servicio', 'comercial', 40, '#34C759'),
    ('Cercos Eléctricos', 'comercial', 50, '#FF9500'),
    ('Internet', 'comercial', 60, '#00C7BE'),
    ('Domótica', 'comercial', 70, '#FF2D55'),
    ('Network', 'comercial', 80, '#00C7BE'),
    ('Materiales', 'interna', 100, '#8E8E93'),
    ('Herramientas', 'interna', 110, '#FF9500'),
    ('Insumos', 'interna', 120, '#AF52DE'),
    ('Consumibles', 'interna', 130, '#5AC8FA')
) as v(name, kind, sort_order, color)
where not exists (
  select 1
  from public.product_categories c
  where lower(trim(c.name)) = lower(trim(v.name))
);

insert into public.product_categories (name, kind, sort_order)
select s.name, 'personalizada', 500
from (
  select
    trim(p.categoria) as name,
    row_number() over (
      partition by lower(trim(p.categoria))
      order by trim(p.categoria)
    ) as rn
  from public.products p
  where p.categoria is not null
    and trim(p.categoria) <> ''
) s
where s.rn = 1
  and not exists (
    select 1
    from public.product_categories c
    where lower(trim(c.name)) = lower(s.name)
  );

alter table public.product_categories enable row level security;

drop policy if exists "Permitir leer product_categories" on public.product_categories;
drop policy if exists "Permitir insertar product_categories" on public.product_categories;
drop policy if exists "Permitir actualizar product_categories" on public.product_categories;
drop policy if exists "Permitir borrar product_categories" on public.product_categories;
create policy "Permitir leer product_categories"
  on public.product_categories for select to anon using (true);
create policy "Permitir insertar product_categories"
  on public.product_categories for insert to anon with check (true);
create policy "Permitir actualizar product_categories"
  on public.product_categories for update to anon using (true) with check (true);
create policy "Permitir borrar product_categories"
  on public.product_categories for delete to anon using (true);

drop policy if exists "Permitir leer product_categories authenticated" on public.product_categories;
drop policy if exists "Permitir insertar product_categories authenticated" on public.product_categories;
drop policy if exists "Permitir actualizar product_categories authenticated" on public.product_categories;
drop policy if exists "Permitir borrar product_categories authenticated" on public.product_categories;
create policy "Permitir leer product_categories authenticated"
  on public.product_categories for select to authenticated using (true);
create policy "Permitir insertar product_categories authenticated"
  on public.product_categories for insert to authenticated with check (true);
create policy "Permitir actualizar product_categories authenticated"
  on public.product_categories for update to authenticated using (true) with check (true);
create policy "Permitir borrar product_categories authenticated"
  on public.product_categories for delete to authenticated using (true);

comment on table public.product_categories is
  'Tipos del catálogo comercial (products.categoria). Las personalizadas se crean desde /productos.';

notify pgrst, 'reload schema';
