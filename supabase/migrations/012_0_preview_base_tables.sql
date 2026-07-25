-- Bootstrap para Supabase Preview / bases frescas.
-- Estas tablas existían en producción fuera del historial de migraciones numerado;
-- sin este stub, Preview falla en 013+ al hacer ALTER/RLS sobre relaciones ausentes.

create extension if not exists pgcrypto;

-- Categorías (también en 014; IF NOT EXISTS es seguro)
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
  created_at timestamptz default now()
);

-- Legacy opcional referenciado por 007 (ahora no-op si no existe; stub vacío por si otros scripts lo asumen)
create table if not exists public.tb_clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  tipo text,
  direccion text,
  telefono text,
  email text
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  created_at timestamptz default now()
);

notify pgrst, 'reload schema';
