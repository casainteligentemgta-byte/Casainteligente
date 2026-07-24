-- Reparación idempotente: columnas que la app de recepción/contabilidad espera.
-- Ejecutar si 132-138 ya corrieron pero sigue "column does not exist" o schema cache.

-- global_inventory.deposit_id (migración 014; a veces no aplicada)
alter table public.global_inventory
  add column if not exists deposit_id uuid references public.inventory_deposits(id) on delete set null;

-- purchase_details
alter table public.purchase_details
  add column if not exists description text,
  add column if not exists item_code text;

-- quality_inspections
alter table public.quality_inspections
  add column if not exists line_description text,
  add column if not exists purchase_detail_id uuid references public.purchase_details(id) on delete set null;

-- purchase_invoices (documentos + proyecto)
alter table public.purchase_invoices
  add column if not exists document_storage_path text,
  add column if not exists document_file_name text,
  add column if not exists document_mime_type text;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ci_proyectos'
  ) then
    alter table public.purchase_invoices
      add column if not exists proyecto_id uuid references public.ci_proyectos(id) on delete set null;
  else
    alter table public.purchase_invoices
      add column if not exists proyecto_id uuid;
    raise notice 'ci_proyectos no existe: proyecto_id sin FK (ejecute migración 037).';
  end if;
end $$;

-- contabilidad_compras (por si 135 falló a medias)
create table if not exists public.contabilidad_compras (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid unique references public.purchase_invoices(id) on delete cascade,
  invoice_number text not null,
  supplier_rif text not null,
  supplier_name text not null,
  fecha date not null,
  total_amount numeric(15, 2) not null default 0,
  moneda text not null default 'USD',
  origen text not null default 'RECEPCION_MERCANCIA',
  estado text not null default 'REGISTRADA',
  document_storage_path text,
  document_file_name text,
  notas text,
  created_at timestamptz not null default now()
);

alter table public.contabilidad_compras
  add column if not exists proyecto_id uuid;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ci_proyectos'
  )
  and not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'contabilidad_compras'
      and constraint_name = 'contabilidad_compras_proyecto_id_fkey'
  ) then
    alter table public.contabilidad_compras
      add constraint contabilidad_compras_proyecto_id_fkey
      foreign key (proyecto_id) references public.ci_proyectos(id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.contabilidad_compra_lineas (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.contabilidad_compras(id) on delete cascade,
  purchase_detail_id uuid references public.purchase_details(id) on delete set null,
  material_id uuid references public.global_inventory(id) on delete set null,
  descripcion text not null,
  item_code text,
  unidad text not null default 'UND',
  cantidad numeric(15, 2) not null,
  precio_unitario numeric(15, 2) not null,
  subtotal numeric(15, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_invoices_proyecto
  on public.purchase_invoices (proyecto_id);
create index if not exists idx_contabilidad_compras_proyecto
  on public.contabilidad_compras (proyecto_id);

alter table public.contabilidad_compras enable row level security;
alter table public.contabilidad_compra_lineas enable row level security;

drop policy if exists "Permitir leer contabilidad_compras anon" on public.contabilidad_compras;
drop policy if exists "Permitir insertar contabilidad_compras anon" on public.contabilidad_compras;
drop policy if exists "Permitir leer contabilidad_compra_lineas anon" on public.contabilidad_compra_lineas;
drop policy if exists "Permitir insertar contabilidad_compra_lineas anon" on public.contabilidad_compra_lineas;

create policy "Permitir leer contabilidad_compras anon"
  on public.contabilidad_compras for select to anon using (true);
create policy "Permitir insertar contabilidad_compras anon"
  on public.contabilidad_compras for insert to anon with check (true);
create policy "Permitir leer contabilidad_compra_lineas anon"
  on public.contabilidad_compra_lineas for select to anon using (true);
create policy "Permitir insertar contabilidad_compra_lineas anon"
  on public.contabilidad_compra_lineas for insert to anon with check (true);

notify pgrst, 'reload schema';
