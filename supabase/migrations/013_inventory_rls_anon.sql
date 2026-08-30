-- Inventario: la app usa Supabase con clave ANON en el navegador.
-- Políticas solo para `authenticated` → error: "new row violates row-level security policy".
-- Igual que products/customers: políticas para rol `anon`.
--
-- Si también tienes material_categories, purchase_*, etc., ejecuta el SQL extra del final
-- o repite el mismo patrón en el SQL Editor.
--
-- Preview: la tabla se creó fuera de migraciones en prod. CREATE IF NOT EXISTS
-- permite aplicar 013+ en un proyecto vacío.

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
