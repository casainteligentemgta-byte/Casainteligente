-- Maestros de almacén: depósitos (varias localidades), armarios/estantes con repisas,
-- categorías y unidades editables desde la app; código SAP autogenerado (SAP-000001).

-- ── Categorías de material (si no existía la tabla) ─────────────────
create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.material_categories(id) on delete set null,
  level integer not null default 1,
  created_at timestamptz default now()
);

create index if not exists idx_material_categories_name on public.material_categories (name);

-- ── Depósitos / bodegas ────────────────────────────────────────────
create table if not exists public.inventory_deposits (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  locality text,
  is_default boolean not null default false,
  created_at timestamptz default now()
);

-- ── Armarios, estantes, etc. (por depósito) + número de repisas ─────
create table if not exists public.inventory_furniture (
  id uuid primary key default gen_random_uuid(),
  deposit_id uuid not null references public.inventory_deposits(id) on delete cascade,
  kind text not null default 'armario',
  name text not null,
  code text,
  repisas_count integer not null default 1
    check (repisas_count >= 1 and repisas_count <= 99),
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_inventory_furniture_deposit on public.inventory_furniture (deposit_id);

-- ── Unidades de medida (catálogo editable) ─────────────────────────
create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- ── global_inventory: ubicación lógica y datos de activo ───────────
alter table public.global_inventory
  add column if not exists deposit_id uuid references public.inventory_deposits(id) on delete set null;
alter table public.global_inventory
  add column if not exists furniture_id uuid references public.inventory_furniture(id) on delete set null;
alter table public.global_inventory
  add column if not exists shelf_number integer;
alter table public.global_inventory
  add column if not exists brand text;
alter table public.global_inventory
  add column if not exists model text;
alter table public.global_inventory
  add column if not exists serial_number text;
alter table public.global_inventory
  add column if not exists status text;
alter table public.global_inventory
  add column if not exists observations text;

-- ── Secuencia SAP ───────────────────────────────────────────────────
create sequence if not exists public.inventory_sap_seq;

create or replace function public.global_inventory_set_sap()
returns trigger
language plpgsql
as $$
begin
  if new.sap_code is null or trim(new.sap_code) = '' then
    new.sap_code := 'SAP-' || lpad(nextval('public.inventory_sap_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists tr_global_inventory_sap on public.global_inventory;
create trigger tr_global_inventory_sap
  before insert on public.global_inventory
  for each row
  execute procedure public.global_inventory_set_sap();

grant usage, select on sequence public.inventory_sap_seq to anon;
grant usage, select on sequence public.inventory_sap_seq to authenticated;
grant usage, select on sequence public.inventory_sap_seq to service_role;

-- ── Datos iniciales ─────────────────────────────────────────────────
insert into public.inventory_deposits (code, name, locality, is_default)
values ('OFI', 'LA OFICINA', null, true)
on conflict (code) do update set name = excluded.name, is_default = excluded.is_default;

insert into public.material_categories (name, parent_id, level)
select v.name, null::uuid, 1
from (values
  ('Herramientas'),
  ('Materiales'),
  ('Maquinaria'),
  ('Combustibles'),
  ('EPP')
) as v(name)
where not exists (
  select 1 from public.material_categories c where c.name = v.name and c.parent_id is null
);

insert into public.inventory_units (code, name, sort_order)
select v.code, v.name, v.ord
from (values
  ('UND', 'Unidad', 1),
  ('PAR', 'Par', 2),
  ('M', 'Metro lineal', 3),
  ('M2', 'Metro cuadrado', 4),
  ('M3', 'Metro cúbico', 5),
  ('KG', 'Kilogramo', 6),
  ('L', 'Litro', 7),
  ('ROL', 'Rollo', 8)
) as v(code, name, ord)
on conflict (code) do nothing;

-- ── RLS (anon, mismo criterio que inventario existente) ─────────────
alter table public.material_categories enable row level security;
alter table public.inventory_deposits enable row level security;
alter table public.inventory_furniture enable row level security;
alter table public.inventory_units enable row level security;

-- material_categories
drop policy if exists "Permitir leer material_categories" on public.material_categories;
drop policy if exists "Permitir insertar material_categories" on public.material_categories;
drop policy if exists "Permitir actualizar material_categories" on public.material_categories;
drop policy if exists "Permitir borrar material_categories" on public.material_categories;
create policy "Permitir leer material_categories"
  on public.material_categories for select to anon using (true);
create policy "Permitir insertar material_categories"
  on public.material_categories for insert to anon with check (true);
create policy "Permitir actualizar material_categories"
  on public.material_categories for update to anon using (true) with check (true);
create policy "Permitir borrar material_categories"
  on public.material_categories for delete to anon using (true);

-- inventory_deposits
drop policy if exists "Permitir leer inventory_deposits" on public.inventory_deposits;
drop policy if exists "Permitir insertar inventory_deposits" on public.inventory_deposits;
drop policy if exists "Permitir actualizar inventory_deposits" on public.inventory_deposits;
drop policy if exists "Permitir borrar inventory_deposits" on public.inventory_deposits;
create policy "Permitir leer inventory_deposits"
  on public.inventory_deposits for select to anon using (true);
create policy "Permitir insertar inventory_deposits"
  on public.inventory_deposits for insert to anon with check (true);
create policy "Permitir actualizar inventory_deposits"
  on public.inventory_deposits for update to anon using (true) with check (true);
create policy "Permitir borrar inventory_deposits"
  on public.inventory_deposits for delete to anon using (true);

-- inventory_furniture
drop policy if exists "Permitir leer inventory_furniture" on public.inventory_furniture;
drop policy if exists "Permitir insertar inventory_furniture" on public.inventory_furniture;
drop policy if exists "Permitir actualizar inventory_furniture" on public.inventory_furniture;
drop policy if exists "Permitir borrar inventory_furniture" on public.inventory_furniture;
create policy "Permitir leer inventory_furniture"
  on public.inventory_furniture for select to anon using (true);
create policy "Permitir insertar inventory_furniture"
  on public.inventory_furniture for insert to anon with check (true);
create policy "Permitir actualizar inventory_furniture"
  on public.inventory_furniture for update to anon using (true) with check (true);
create policy "Permitir borrar inventory_furniture"
  on public.inventory_furniture for delete to anon using (true);

-- inventory_units
drop policy if exists "Permitir leer inventory_units" on public.inventory_units;
drop policy if exists "Permitir insertar inventory_units" on public.inventory_units;
drop policy if exists "Permitir actualizar inventory_units" on public.inventory_units;
drop policy if exists "Permitir borrar inventory_units" on public.inventory_units;
create policy "Permitir leer inventory_units"
  on public.inventory_units for select to anon using (true);
create policy "Permitir insertar inventory_units"
  on public.inventory_units for insert to anon with check (true);
create policy "Permitir actualizar inventory_units"
  on public.inventory_units for update to anon using (true) with check (true);
create policy "Permitir borrar inventory_units"
  on public.inventory_units for delete to anon using (true);
