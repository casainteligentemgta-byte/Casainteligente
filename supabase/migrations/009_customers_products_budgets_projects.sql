-- Modelo CRM en inglés usado por /clientes, /productos, /ventas (presupuestos), /presupuestos y Kanban.
-- Idempotente: solo crea si no existen.

-- ── customers ─────────────────────────────────────────
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rif text,
  movil text,
  email text,
  tipo text,
  status text default 'activo',
  direccion text,
  imagen text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_customers_nombre on public.customers (nombre);

alter table public.customers enable row level security;

drop policy if exists "Permitir leer customers" on public.customers;
create policy "Permitir leer customers"
  on public.customers for select to anon using (true);
drop policy if exists "Permitir insertar customers" on public.customers;
create policy "Permitir insertar customers"
  on public.customers for insert to anon with check (true);
drop policy if exists "Permitir actualizar customers" on public.customers;
create policy "Permitir actualizar customers"
  on public.customers for update to anon using (true) with check (true);
drop policy if exists "Permitir borrar customers" on public.customers;
create policy "Permitir borrar customers"
  on public.customers for delete to anon using (true);

-- ── products (catálogo comercial; id numérico compatible con legacy) ──
create table if not exists public.products (
  id bigint generated always as identity primary key,
  external_id bigint,
  nombre text not null,
  categoria text,
  modelo text,
  marca text,
  descripcion text,
  descripcion2 text,
  costo numeric(14,2),
  precio numeric(14,2),
  utilidad numeric(14,2),
  cantidad numeric(14,3),
  imagen text,
  ubicacion text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_products_nombre on public.products (nombre);
create index if not exists idx_products_categoria on public.products (categoria);

alter table public.products enable row level security;

drop policy if exists "Permitir leer products" on public.products;
create policy "Permitir leer products"
  on public.products for select to anon using (true);
drop policy if exists "Permitir insertar products" on public.products;
create policy "Permitir insertar products"
  on public.products for insert to anon with check (true);
drop policy if exists "Permitir actualizar products" on public.products;
create policy "Permitir actualizar products"
  on public.products for update to anon using (true) with check (true);
drop policy if exists "Permitir borrar products" on public.products;
create policy "Permitir borrar products"
  on public.products for delete to anon using (true);

-- ── budgets (presupuestos con ítems en JSON) ───────────
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_rif text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0,
  total_cost numeric(14,2),
  total_profit numeric(14,2),
  margin_pct numeric(7,2),
  notes text,
  show_zelle boolean default true,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'aprobado', 'rechazado', 'archivado')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_budgets_customer on public.budgets (customer_id);
create index if not exists idx_budgets_status on public.budgets (status);
create index if not exists idx_budgets_created on public.budgets (created_at desc);

alter table public.budgets enable row level security;

drop policy if exists "Permitir leer budgets" on public.budgets;
create policy "Permitir leer budgets"
  on public.budgets for select to anon using (true);
drop policy if exists "Permitir insertar budgets" on public.budgets;
create policy "Permitir insertar budgets"
  on public.budgets for insert to anon with check (true);
drop policy if exists "Permitir actualizar budgets" on public.budgets;
create policy "Permitir actualizar budgets"
  on public.budgets for update to anon using (true) with check (true);
drop policy if exists "Permitir borrar budgets" on public.budgets;
create policy "Permitir borrar budgets"
  on public.budgets for delete to anon using (true);

-- ── projects (Kanban / instalaciones) ─────────────────
-- sale_price / cost_price duplican margen del presupuesto para consultas rápidas en UI.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'Pendiente',
  budget_id uuid references public.budgets(id) on delete set null,
  sale_price numeric(14,2),
  cost_price numeric(14,2),
  description text,
  installation_address text,
  lat double precision,
  lng double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_projects_status on public.projects (status);
create index if not exists idx_projects_budget on public.projects (budget_id);

alter table public.projects enable row level security;

drop policy if exists "Permitir leer projects" on public.projects;
create policy "Permitir leer projects"
  on public.projects for select to anon using (true);
drop policy if exists "Permitir insertar projects" on public.projects;
create policy "Permitir insertar projects"
  on public.projects for insert to anon with check (true);
drop policy if exists "Permitir actualizar projects" on public.projects;
create policy "Permitir actualizar projects"
  on public.projects for update to anon using (true) with check (true);
drop policy if exists "Permitir borrar projects" on public.projects;
create policy "Permitir borrar projects"
  on public.projects for delete to anon using (true);
