-- Inventario: la app usa Supabase con clave ANON en el navegador.
-- Políticas solo para `authenticated` → error: "new row violates row-level security policy".
-- Igual que products/customers: políticas para rol `anon`.
--
-- Si también tienes material_categories, purchase_*, etc., ejecuta el SQL extra del final
-- o repite el mismo patrón en el SQL Editor.
--
-- Preview/fresh DB: crear tablas base si no existen (históricamente creadas fuera del repo).

create extension if not exists pgcrypto;

create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.material_categories (id) on delete set null,
  level integer not null default 1,
  created_at timestamptz default now()
);

create table if not exists public.global_inventory (
  id uuid primary key default gen_random_uuid(),
  sap_code text unique,
  name text not null,
  category_id uuid references public.material_categories (id),
  unit text not null default 'UND',
  stock_available numeric(15, 2) default 0,
  stock_quarantine numeric(15, 2) default 0,
  reorder_point numeric(15, 2) default 0,
  average_weighted_cost numeric(15, 2) default 0,
  location text,
  image_url text,
  last_purchase_date timestamptz,
  last_purchase_price numeric(15, 2),
  last_supplier_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_alerts (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.global_inventory (id) on delete cascade,
  alert_type text,
  message text,
  acknowledged boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.global_inventory (id) on delete set null,
  movement_type_code text,
  quantity numeric(15, 2) not null default 0,
  previous_stock numeric(15, 2),
  new_stock numeric(15, 2),
  previous_cost numeric(15, 2),
  new_cost numeric(15, 2),
  reference_id text,
  user_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text,
  supplier_rif text,
  supplier_name text,
  date date,
  total_amount numeric(15, 2) not null default 0,
  status text not null default 'PENDIENTE',
  created_at timestamptz default now()
);

create table if not exists public.purchase_details (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.purchase_invoices (id) on delete cascade,
  material_id uuid references public.global_inventory (id) on delete set null,
  quantity numeric(15, 2) not null default 0,
  unit_price numeric(15, 2) not null default 0,
  total_price numeric(15, 2) not null default 0,
  description text,
  item_code text,
  created_at timestamptz default now()
);

create table if not exists public.quality_inspections (
  id uuid primary key default gen_random_uuid(),
  purchase_detail_id uuid references public.purchase_details (id) on delete set null,
  material_id uuid references public.global_inventory (id) on delete set null,
  status text not null default 'PENDIENTE',
  line_description text,
  remarks text,
  inspected_at timestamptz,
  created_at timestamptz default now()
);

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
