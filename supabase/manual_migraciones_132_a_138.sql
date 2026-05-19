-- =============================================================================
-- CASA INTELIGENTE — Migraciones 132 a 138 (recepción mercancía + contabilidad)
-- Ejecutar TODO en: Supabase → SQL Editor → New query → Run
-- Requiere tablas base: purchase_invoices, purchase_details, quality_inspections,
--   global_inventory, inventory_movements, inventory_deposits, ci_proyectos
-- Después: Settings → API → Reload schema (o esperar 1–2 min)
-- =============================================================================

-- ── 132: descripción en líneas de factura ───────────────────────────────────
alter table public.purchase_details
  add column if not exists description text,
  add column if not exists item_code text;

comment on column public.purchase_details.description is 'Descripción del artículo según la factura de compra.';
comment on column public.purchase_details.item_code is 'Código o referencia del proveedor en la factura.';

alter table public.quality_inspections
  add column if not exists line_description text;

comment on column public.quality_inspections.line_description is 'Copia de la descripción de la línea de factura para cuarentena.';

-- ── 133: bucket documentos de compra ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('procurement-documents', 'procurement-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "procurement_documents_select_anon" on storage.objects;
drop policy if exists "procurement_documents_insert_anon" on storage.objects;
drop policy if exists "procurement_documents_update_anon" on storage.objects;
drop policy if exists "procurement_documents_select_auth" on storage.objects;
drop policy if exists "procurement_documents_insert_auth" on storage.objects;
drop policy if exists "procurement_documents_update_auth" on storage.objects;

create policy "procurement_documents_select_anon"
on storage.objects for select to anon
using (bucket_id = 'procurement-documents');

create policy "procurement_documents_insert_anon"
on storage.objects for insert to anon
with check (bucket_id = 'procurement-documents');

create policy "procurement_documents_update_anon"
on storage.objects for update to anon
using (bucket_id = 'procurement-documents')
with check (bucket_id = 'procurement-documents');

create policy "procurement_documents_select_auth"
on storage.objects for select to authenticated
using (bucket_id = 'procurement-documents');

create policy "procurement_documents_insert_auth"
on storage.objects for insert to authenticated
with check (bucket_id = 'procurement-documents');

create policy "procurement_documents_update_auth"
on storage.objects for update to authenticated
using (bucket_id = 'procurement-documents')
with check (bucket_id = 'procurement-documents');

alter table public.purchase_invoices
  add column if not exists document_storage_path text,
  add column if not exists document_file_name text,
  add column if not exists document_mime_type text;

comment on column public.purchase_invoices.document_storage_path is
  'Ruta en bucket procurement-documents del PDF/foto original.';
comment on column public.purchase_invoices.document_file_name is
  'Nombre original del archivo subido.';
comment on column public.purchase_invoices.document_mime_type is
  'MIME del archivo (application/pdf, image/jpeg, etc.).';

-- ── 134: RLS anon en purchase_* ─────────────────────────────────────────────
alter table public.purchase_invoices enable row level security;
alter table public.purchase_details enable row level security;
alter table public.quality_inspections enable row level security;

drop policy if exists "Allow authenticated Read" on public.purchase_invoices;
drop policy if exists "Allow authenticated Insert" on public.purchase_invoices;
drop policy if exists "Allow authenticated Update" on public.purchase_invoices;
drop policy if exists "Permitir leer purchase_invoices" on public.purchase_invoices;
drop policy if exists "Permitir insertar purchase_invoices" on public.purchase_invoices;
drop policy if exists "Permitir actualizar purchase_invoices" on public.purchase_invoices;

create policy "Permitir leer purchase_invoices"
  on public.purchase_invoices for select to anon using (true);
create policy "Permitir insertar purchase_invoices"
  on public.purchase_invoices for insert to anon with check (true);
create policy "Permitir actualizar purchase_invoices"
  on public.purchase_invoices for update to anon using (true) with check (true);

create policy "Permitir leer purchase_invoices authenticated"
  on public.purchase_invoices for select to authenticated using (true);
create policy "Permitir insertar purchase_invoices authenticated"
  on public.purchase_invoices for insert to authenticated with check (true);
create policy "Permitir actualizar purchase_invoices authenticated"
  on public.purchase_invoices for update to authenticated using (true) with check (true);

drop policy if exists "Allow authenticated Read" on public.purchase_details;
drop policy if exists "Allow authenticated Insert" on public.purchase_details;
drop policy if exists "Permitir leer purchase_details" on public.purchase_details;
drop policy if exists "Permitir insertar purchase_details" on public.purchase_details;

create policy "Permitir leer purchase_details"
  on public.purchase_details for select to anon using (true);
create policy "Permitir insertar purchase_details"
  on public.purchase_details for insert to anon with check (true);

create policy "Permitir leer purchase_details authenticated"
  on public.purchase_details for select to authenticated using (true);
create policy "Permitir insertar purchase_details authenticated"
  on public.purchase_details for insert to authenticated with check (true);

drop policy if exists "Allow authenticated Read" on public.quality_inspections;
drop policy if exists "Allow authenticated Insert" on public.quality_inspections;
drop policy if exists "Allow authenticated Update" on public.quality_inspections;
drop policy if exists "Permitir leer quality_inspections" on public.quality_inspections;
drop policy if exists "Permitir insertar quality_inspections" on public.quality_inspections;
drop policy if exists "Permitir actualizar quality_inspections" on public.quality_inspections;

create policy "Permitir leer quality_inspections"
  on public.quality_inspections for select to anon using (true);
create policy "Permitir insertar quality_inspections"
  on public.quality_inspections for insert to anon with check (true);
create policy "Permitir actualizar quality_inspections"
  on public.quality_inspections for update to anon using (true) with check (true);

create policy "Permitir leer quality_inspections authenticated"
  on public.quality_inspections for select to authenticated using (true);
create policy "Permitir insertar quality_inspections authenticated"
  on public.quality_inspections for insert to authenticated with check (true);
create policy "Permitir actualizar quality_inspections authenticated"
  on public.quality_inspections for update to authenticated using (true) with check (true);

-- ── 135: contabilidad_compras ───────────────────────────────────────────────
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

alter table public.contabilidad_compras enable row level security;
alter table public.contabilidad_compra_lineas enable row level security;

drop policy if exists "Permitir leer contabilidad_compras anon" on public.contabilidad_compras;
drop policy if exists "Permitir insertar contabilidad_compras anon" on public.contabilidad_compras;
drop policy if exists "Permitir actualizar contabilidad_compras anon" on public.contabilidad_compras;
drop policy if exists "Permitir leer contabilidad_compras authenticated" on public.contabilidad_compras;
drop policy if exists "Permitir insertar contabilidad_compras authenticated" on public.contabilidad_compras;
drop policy if exists "Permitir actualizar contabilidad_compras authenticated" on public.contabilidad_compras;

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

drop policy if exists "Permitir leer contabilidad_compra_lineas anon" on public.contabilidad_compra_lineas;
drop policy if exists "Permitir insertar contabilidad_compra_lineas anon" on public.contabilidad_compra_lineas;
drop policy if exists "Permitir leer contabilidad_compra_lineas authenticated" on public.contabilidad_compra_lineas;
drop policy if exists "Permitir insertar contabilidad_compra_lineas authenticated" on public.contabilidad_compra_lineas;

create policy "Permitir leer contabilidad_compra_lineas anon"
  on public.contabilidad_compra_lineas for select to anon using (true);
create policy "Permitir insertar contabilidad_compra_lineas anon"
  on public.contabilidad_compra_lineas for insert to anon with check (true);

create policy "Permitir leer contabilidad_compra_lineas authenticated"
  on public.contabilidad_compra_lineas for select to authenticated using (true);
create policy "Permitir insertar contabilidad_compra_lineas authenticated"
  on public.contabilidad_compra_lineas for insert to authenticated with check (true);

-- ── 136: RLS inventory_movements ────────────────────────────────────────────
alter table public.inventory_movements enable row level security;

drop policy if exists "Allow authenticated Read" on public.inventory_movements;
drop policy if exists "Allow authenticated Insert" on public.inventory_movements;
drop policy if exists "Permitir leer inventory_movements" on public.inventory_movements;
drop policy if exists "Permitir insertar inventory_movements" on public.inventory_movements;
drop policy if exists "Permitir leer inventory_movements authenticated" on public.inventory_movements;
drop policy if exists "Permitir insertar inventory_movements authenticated" on public.inventory_movements;

create policy "Permitir leer inventory_movements"
  on public.inventory_movements for select to anon using (true);
create policy "Permitir insertar inventory_movements"
  on public.inventory_movements for insert to anon with check (true);

create policy "Permitir leer inventory_movements authenticated"
  on public.inventory_movements for select to authenticated using (true);
create policy "Permitir insertar inventory_movements authenticated"
  on public.inventory_movements for insert to authenticated with check (true);

-- ── 137: locality depósito por defecto ───────────────────────────────────────
update public.inventory_deposits
set locality = coalesce(nullif(trim(locality), ''), 'Sede principal')
where code = 'OFI' and is_default = true;

comment on column public.inventory_deposits.locality is
  'Localidad o sede del depósito; se muestra en inventario junto al nombre.';

-- ── 138: proyecto en compras + DELETE ───────────────────────────────────────
alter table public.purchase_invoices
  add column if not exists proyecto_id uuid references public.ci_proyectos(id) on delete set null;

alter table public.contabilidad_compras
  add column if not exists proyecto_id uuid references public.ci_proyectos(id) on delete set null;

create index if not exists idx_purchase_invoices_proyecto
  on public.purchase_invoices (proyecto_id);

create index if not exists idx_contabilidad_compras_proyecto
  on public.contabilidad_compras (proyecto_id);

comment on column public.purchase_invoices.proyecto_id is
  'Proyecto / obra al que se imputa la compra de mercancía.';
comment on column public.contabilidad_compras.proyecto_id is
  'Proyecto / obra al que se imputa el egreso en contabilidad.';

drop policy if exists "Permitir borrar contabilidad_compras anon" on public.contabilidad_compras;
drop policy if exists "Permitir borrar contabilidad_compras authenticated" on public.contabilidad_compras;
drop policy if exists "Permitir borrar contabilidad_compra_lineas anon" on public.contabilidad_compra_lineas;
drop policy if exists "Permitir borrar contabilidad_compra_lineas authenticated" on public.contabilidad_compra_lineas;
drop policy if exists "Permitir borrar purchase_invoices anon" on public.purchase_invoices;
drop policy if exists "Permitir borrar purchase_invoices authenticated" on public.purchase_invoices;
drop policy if exists "Permitir borrar purchase_details anon" on public.purchase_details;
drop policy if exists "Permitir borrar purchase_details authenticated" on public.purchase_details;
drop policy if exists "Permitir borrar quality_inspections anon" on public.quality_inspections;
drop policy if exists "Permitir borrar quality_inspections authenticated" on public.quality_inspections;

create policy "Permitir borrar contabilidad_compras anon"
  on public.contabilidad_compras for delete to anon using (true);
create policy "Permitir borrar contabilidad_compras authenticated"
  on public.contabilidad_compras for delete to authenticated using (true);

create policy "Permitir borrar contabilidad_compra_lineas anon"
  on public.contabilidad_compra_lineas for delete to anon using (true);
create policy "Permitir borrar contabilidad_compra_lineas authenticated"
  on public.contabilidad_compra_lineas for delete to authenticated using (true);

create policy "Permitir borrar purchase_invoices anon"
  on public.purchase_invoices for delete to anon using (true);
create policy "Permitir borrar purchase_invoices authenticated"
  on public.purchase_invoices for delete to authenticated using (true);

create policy "Permitir borrar purchase_details anon"
  on public.purchase_details for delete to anon using (true);
create policy "Permitir borrar purchase_details authenticated"
  on public.purchase_details for delete to authenticated using (true);

create policy "Permitir borrar quality_inspections anon"
  on public.quality_inspections for delete to anon using (true);
create policy "Permitir borrar quality_inspections authenticated"
  on public.quality_inspections for delete to authenticated using (true);

notify pgrst, 'reload schema';
