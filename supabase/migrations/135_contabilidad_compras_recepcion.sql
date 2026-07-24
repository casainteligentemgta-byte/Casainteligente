-- Contabilidad › Compras: registro contable de facturas capturadas en recepción de mercancía.

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

create index if not exists idx_contabilidad_compras_fecha
  on public.contabilidad_compras (fecha desc);

create index if not exists idx_contabilidad_compras_proveedor
  on public.contabilidad_compras (supplier_name);

comment on table public.contabilidad_compras is
  'Libro de compras / egresos por factura de proveedor (origen recepción de mercancía).';

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

create index if not exists idx_contabilidad_compra_lineas_compra
  on public.contabilidad_compra_lineas (compra_id);

comment on table public.contabilidad_compra_lineas is
  'Detalle contable por línea de factura de compra.';

-- RLS (anon + authenticated, mismo patrón que compras/almacén)
alter table public.contabilidad_compras enable row level security;
alter table public.contabilidad_compra_lineas enable row level security;

create policy "Permitir leer contabilidad_compras anon"
  on public.contabilidad_compras for select to anon using (true);
create policy "Permitir insertar contabilidad_compras anon"
  on public.contabilidad_compras for insert to anon with check (true);
create policy "Permitir actualizar contabilidad_compras anon"
  on public.contabilidad_compras for update to anon using (true) with check (true);

create policy "Permitir leer contabilidad_compras authenticated"
  on public.contabilidad_compras for select to authenticated using (true);
create policy "Permitir insertar contabilidad_compras authenticated"
  on public.contabilidad_compras for insert to authenticated with check (true);
create policy "Permitir actualizar contabilidad_compras authenticated"
  on public.contabilidad_compras for update to authenticated using (true) with check (true);

create policy "Permitir leer contabilidad_compra_lineas anon"
  on public.contabilidad_compra_lineas for select to anon using (true);
create policy "Permitir insertar contabilidad_compra_lineas anon"
  on public.contabilidad_compra_lineas for insert to anon with check (true);

create policy "Permitir leer contabilidad_compra_lineas authenticated"
  on public.contabilidad_compra_lineas for select to authenticated using (true);
create policy "Permitir insertar contabilidad_compra_lineas authenticated"
  on public.contabilidad_compra_lineas for insert to authenticated with check (true);
