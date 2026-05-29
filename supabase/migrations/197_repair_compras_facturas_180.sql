-- Repair idempotente: tablas compras + stock (si migr. 180 falló a mitad).
-- Ejecutar si la app muestra «Tabla compras_facturas no existe».

-- Ubicaciones mínimas (FK de compras_facturas)
create table if not exists public.inv_ubicaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  tipo text not null
    check (tipo in ('almacen_central', 'almacen_movil', 'obra', 'garantias', 'cuarentena')),
  deposit_id uuid references public.inventory_deposits (id) on delete set null,
  ci_proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inv_ubicaciones_codigo_unique unique (codigo)
);

create table if not exists public.inventario_stock (
  id uuid primary key default gen_random_uuid(),
  ubicacion_id uuid not null references public.inv_ubicaciones (id) on delete cascade,
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  cantidad_disponible numeric(15, 4) not null default 0 check (cantidad_disponible >= 0),
  cantidad_reservada numeric(15, 4) not null default 0 check (cantidad_reservada >= 0),
  cantidad_en_transito_entrante numeric(15, 4) not null default 0
    check (cantidad_en_transito_entrante >= 0),
  updated_at timestamptz not null default now(),
  constraint inventario_stock_ubicacion_material_unique unique (ubicacion_id, material_id)
);

create table if not exists public.compras_facturas (
  id uuid primary key default gen_random_uuid(),
  numero_factura text not null,
  proveedor_rif text,
  proveedor_nombre text not null default '',
  fecha_emision date not null default (current_date),
  subtotal numeric(15, 2) not null default 0,
  impuesto numeric(15, 2) not null default 0,
  total numeric(15, 2) not null default 0,
  condicion_pago text not null default 'contado'
    check (condicion_pago in ('contado', 'credito')),
  dias_credito integer check (dias_credito is null or dias_credito > 0),
  documento_url text,
  documento_storage_path text,
  ubicacion_destino_id uuid not null references public.inv_ubicaciones (id) on delete restrict,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'registrada', 'anulada')),
  purchase_invoice_id uuid references public.purchase_invoices (id) on delete set null,
  registrado_por uuid references auth.users (id) on delete set null,
  registrada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists compras_facturas_numero_proveedor_unique
  on public.compras_facturas (numero_factura, coalesce(proveedor_rif, ''));

create index if not exists idx_compras_facturas_ubicacion on public.compras_facturas (ubicacion_destino_id);
create index if not exists idx_compras_facturas_estado on public.compras_facturas (estado);

create table if not exists public.compras_factura_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.compras_facturas (id) on delete cascade,
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  descripcion text not null default '',
  cantidad numeric(15, 4) not null check (cantidad > 0),
  precio_unitario numeric(15, 4) not null default 0 check (precio_unitario >= 0),
  requiere_serie boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_compras_factura_lineas_factura on public.compras_factura_lineas (factura_id);

create or replace function public.inv_stock_apply_delta(
  p_ubicacion_id uuid,
  p_material_id uuid,
  p_delta_disponible numeric default 0,
  p_delta_reservada numeric default 0,
  p_delta_transito_entrante numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventario_stock (ubicacion_id, material_id)
  values (p_ubicacion_id, p_material_id)
  on conflict (ubicacion_id, material_id) do nothing;

  update public.inventario_stock s
  set
    cantidad_disponible = greatest(0, s.cantidad_disponible + coalesce(p_delta_disponible, 0)),
    cantidad_reservada = greatest(0, s.cantidad_reservada + coalesce(p_delta_reservada, 0)),
    cantidad_en_transito_entrante = greatest(
      0,
      s.cantidad_en_transito_entrante + coalesce(p_delta_transito_entrante, 0)
    ),
    updated_at = now()
  where s.ubicacion_id = p_ubicacion_id and s.material_id = p_material_id;

  if not found then
    raise exception 'No se pudo actualizar stock para ubicación % material %', p_ubicacion_id, p_material_id;
  end if;
end;
$$;

create or replace function public.inv_compra_registrar_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ubicacion uuid;
  r record;
begin
  if new.estado = 'registrada' and (old.estado is distinct from 'registrada') then
    v_ubicacion := new.ubicacion_destino_id;
    for r in
      select material_id, sum(cantidad) as qty
      from public.compras_factura_lineas
      where factura_id = new.id
      group by material_id
    loop
      perform public.inv_stock_apply_delta(v_ubicacion, r.material_id, r.qty, 0, 0);
    end loop;
    new.registrada_at := coalesce(new.registrada_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists tr_inv_compra_registrar_stock on public.compras_facturas;
create trigger tr_inv_compra_registrar_stock
  before update on public.compras_facturas
  for each row
  execute function public.inv_compra_registrar_stock();

alter table public.compras_facturas enable row level security;
alter table public.compras_factura_lineas enable row level security;

drop policy if exists "compras_facturas_select_anon" on public.compras_facturas;
drop policy if exists "compras_facturas_insert_anon" on public.compras_facturas;
drop policy if exists "compras_facturas_update_anon" on public.compras_facturas;
drop policy if exists "compras_facturas_delete_anon" on public.compras_facturas;

create policy "compras_facturas_select_anon" on public.compras_facturas for select to anon using (true);
create policy "compras_facturas_insert_anon" on public.compras_facturas for insert to anon with check (true);
create policy "compras_facturas_update_anon" on public.compras_facturas for update to anon using (true) with check (true);
create policy "compras_facturas_delete_anon" on public.compras_facturas for delete to anon using (true);

drop policy if exists "compras_factura_lineas_select_anon" on public.compras_factura_lineas;
drop policy if exists "compras_factura_lineas_insert_anon" on public.compras_factura_lineas;
drop policy if exists "compras_factura_lineas_update_anon" on public.compras_factura_lineas;
drop policy if exists "compras_factura_lineas_delete_anon" on public.compras_factura_lineas;

create policy "compras_factura_lineas_select_anon" on public.compras_factura_lineas for select to anon using ( true);
create policy "compras_factura_lineas_insert_anon" on public.compras_factura_lineas for insert to anon with check (true);
create policy "compras_factura_lineas_update_anon" on public.compras_factura_lineas for update to anon using (true) with check (true);
create policy "compras_factura_lineas_delete_anon" on public.compras_factura_lineas for delete to anon using (true);

notify pgrst, 'reload schema';
