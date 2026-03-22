-- =============================================================================
-- CASA INTELIGENTE — Inventario / Almacén (Supabase SQL Editor)
-- Ejecuta TODO el script de una vez (o por bloques si falla alguna parte).
-- Requisito: proyecto Supabase con extensión pgcrypto o gen_random_uuid() activa.
-- =============================================================================

-- ── 0) Tablas base (solo si aún no existen) ─────────────────────────────────
create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.material_categories(id) on delete set null,
  level integer not null default 1,
  created_at timestamptz default now()
);

create table if not exists public.global_inventory (
  id uuid primary key default gen_random_uuid(),
  sap_code text unique,
  name text not null,
  category_id uuid references public.material_categories(id),
  unit text not null,
  stock_available numeric(15,2) default 0,
  stock_quarantine numeric(15,2) default 0,
  reorder_point numeric(15,2) default 0,
  average_weighted_cost numeric(15,2) default 0,
  location text,
  image_url text,
  last_purchase_date timestamptz,
  last_purchase_price numeric(15,2),
  last_supplier_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_material_categories_name on public.material_categories (name);

-- ── 1) RLS global_inventory — rol ANON (app con clave pública sin sesión) ───
alter table public.global_inventory enable row level security;

drop policy if exists "Allow authenticated Read" on public.global_inventory;
drop policy if exists "Allow authenticated Insert" on public.global_inventory;
drop policy if exists "Allow authenticated Update" on public.global_inventory;
drop policy if exists "Allow authenticated Delete" on public.global_inventory;

drop policy if exists "Permitir leer global_inventory" on public.global_inventory;
drop policy if exists "Permitir insertar global_inventory" on public.global_inventory;
drop policy if exists "Permitir actualizar global_inventory" on public.global_inventory;
drop policy if exists "Permitir borrar global_inventory" on public.global_inventory;

create policy "Permitir leer global_inventory"
  on public.global_inventory for select to anon using (true);
create policy "Permitir insertar global_inventory"
  on public.global_inventory for insert to anon with check (true);
create policy "Permitir actualizar global_inventory"
  on public.global_inventory for update to anon using (true) with check (true);
create policy "Permitir borrar global_inventory"
  on public.global_inventory for delete to anon using (true);

-- ── 2) Maestros: depósitos, muebles, unidades, columnas extra, SAP, semillas ──
create table if not exists public.inventory_deposits (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  locality text,
  is_default boolean not null default false,
  created_at timestamptz default now()
);

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

create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

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

-- ── 3) RLS maestros — ANON ─────────────────────────────────────────────────
alter table public.material_categories enable row level security;
alter table public.inventory_deposits enable row level security;
alter table public.inventory_furniture enable row level security;
alter table public.inventory_units enable row level security;

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

-- ── 4) RLS — AUTHENTICATED (usuarios con sesión / login) ─────────────────────
drop policy if exists "Permitir leer global_inventory authenticated" on public.global_inventory;
drop policy if exists "Permitir insertar global_inventory authenticated" on public.global_inventory;
drop policy if exists "Permitir actualizar global_inventory authenticated" on public.global_inventory;
drop policy if exists "Permitir borrar global_inventory authenticated" on public.global_inventory;
create policy "Permitir leer global_inventory authenticated"
  on public.global_inventory for select to authenticated using (true);
create policy "Permitir insertar global_inventory authenticated"
  on public.global_inventory for insert to authenticated with check (true);
create policy "Permitir actualizar global_inventory authenticated"
  on public.global_inventory for update to authenticated using (true) with check (true);
create policy "Permitir borrar global_inventory authenticated"
  on public.global_inventory for delete to authenticated using (true);

drop policy if exists "Permitir leer material_categories authenticated" on public.material_categories;
drop policy if exists "Permitir insertar material_categories authenticated" on public.material_categories;
drop policy if exists "Permitir actualizar material_categories authenticated" on public.material_categories;
drop policy if exists "Permitir borrar material_categories authenticated" on public.material_categories;
create policy "Permitir leer material_categories authenticated"
  on public.material_categories for select to authenticated using (true);
create policy "Permitir insertar material_categories authenticated"
  on public.material_categories for insert to authenticated with check (true);
create policy "Permitir actualizar material_categories authenticated"
  on public.material_categories for update to authenticated using (true) with check (true);
create policy "Permitir borrar material_categories authenticated"
  on public.material_categories for delete to authenticated using (true);

drop policy if exists "Permitir leer inventory_deposits authenticated" on public.inventory_deposits;
drop policy if exists "Permitir insertar inventory_deposits authenticated" on public.inventory_deposits;
drop policy if exists "Permitir actualizar inventory_deposits authenticated" on public.inventory_deposits;
drop policy if exists "Permitir borrar inventory_deposits authenticated" on public.inventory_deposits;
create policy "Permitir leer inventory_deposits authenticated"
  on public.inventory_deposits for select to authenticated using (true);
create policy "Permitir insertar inventory_deposits authenticated"
  on public.inventory_deposits for insert to authenticated with check (true);
create policy "Permitir actualizar inventory_deposits authenticated"
  on public.inventory_deposits for update to authenticated using (true) with check (true);
create policy "Permitir borrar inventory_deposits authenticated"
  on public.inventory_deposits for delete to authenticated using (true);

drop policy if exists "Permitir leer inventory_furniture authenticated" on public.inventory_furniture;
drop policy if exists "Permitir insertar inventory_furniture authenticated" on public.inventory_furniture;
drop policy if exists "Permitir actualizar inventory_furniture authenticated" on public.inventory_furniture;
drop policy if exists "Permitir borrar inventory_furniture authenticated" on public.inventory_furniture;
create policy "Permitir leer inventory_furniture authenticated"
  on public.inventory_furniture for select to authenticated using (true);
create policy "Permitir insertar inventory_furniture authenticated"
  on public.inventory_furniture for insert to authenticated with check (true);
create policy "Permitir actualizar inventory_furniture authenticated"
  on public.inventory_furniture for update to authenticated using (true) with check (true);
create policy "Permitir borrar inventory_furniture authenticated"
  on public.inventory_furniture for delete to authenticated using (true);

drop policy if exists "Permitir leer inventory_units authenticated" on public.inventory_units;
drop policy if exists "Permitir insertar inventory_units authenticated" on public.inventory_units;
drop policy if exists "Permitir actualizar inventory_units authenticated" on public.inventory_units;
drop policy if exists "Permitir borrar inventory_units authenticated" on public.inventory_units;
create policy "Permitir leer inventory_units authenticated"
  on public.inventory_units for select to authenticated using (true);
create policy "Permitir insertar inventory_units authenticated"
  on public.inventory_units for insert to authenticated with check (true);
create policy "Permitir actualizar inventory_units authenticated"
  on public.inventory_units for update to authenticated using (true) with check (true);
create policy "Permitir borrar inventory_units authenticated"
  on public.inventory_units for delete to authenticated using (true);

-- ── 5) inventory_alerts (triggers / app que insertan alertas) ────────────────
-- Si falla "relation inventory_alerts does not exist", omite este bloque (no la usas aún).
alter table public.inventory_alerts enable row level security;

drop policy if exists "Permitir leer inventory_alerts" on public.inventory_alerts;
drop policy if exists "Permitir insertar inventory_alerts" on public.inventory_alerts;
drop policy if exists "Permitir actualizar inventory_alerts" on public.inventory_alerts;
drop policy if exists "Permitir borrar inventory_alerts" on public.inventory_alerts;
create policy "Permitir leer inventory_alerts"
  on public.inventory_alerts for select to anon using (true);
create policy "Permitir insertar inventory_alerts"
  on public.inventory_alerts for insert to anon with check (true);
create policy "Permitir actualizar inventory_alerts"
  on public.inventory_alerts for update to anon using (true) with check (true);
create policy "Permitir borrar inventory_alerts"
  on public.inventory_alerts for delete to anon using (true);

drop policy if exists "Permitir leer inventory_alerts authenticated" on public.inventory_alerts;
drop policy if exists "Permitir insertar inventory_alerts authenticated" on public.inventory_alerts;
drop policy if exists "Permitir actualizar inventory_alerts authenticated" on public.inventory_alerts;
drop policy if exists "Permitir borrar inventory_alerts authenticated" on public.inventory_alerts;
create policy "Permitir leer inventory_alerts authenticated"
  on public.inventory_alerts for select to authenticated using (true);
create policy "Permitir insertar inventory_alerts authenticated"
  on public.inventory_alerts for insert to authenticated with check (true);
create policy "Permitir actualizar inventory_alerts authenticated"
  on public.inventory_alerts for update to authenticated using (true) with check (true);
create policy "Permitir borrar inventory_alerts authenticated"
  on public.inventory_alerts for delete to authenticated using (true);

-- =============================================================================
-- Fin. Si el trigger falla por sintaxis, prueba:
--   execute function public.global_inventory_set_sap();
-- en lugar de execute procedure ...
-- =============================================================================
