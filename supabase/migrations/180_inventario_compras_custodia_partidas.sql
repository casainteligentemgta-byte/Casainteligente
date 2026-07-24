-- Módulo Inventario, Compras, Transferencias (cadena de custodia) e imputación por partidas.
-- Integra con: global_inventory, inventory_deposits, ci_proyectos, partidas, ci_presupuesto_partidas,
-- purchase_invoices (puente opcional).

-- ── 1. Ubicaciones unificadas (almacén, móvil, obra, garantías) ─────────────────
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
  constraint inv_ubicaciones_codigo_unique unique (codigo),
  constraint inv_ubicaciones_tipo_deposit check (
    tipo in ('almacen_central', 'almacen_movil', 'cuarentena') or deposit_id is null
  ),
  constraint inv_ubicaciones_tipo_obra check (
    tipo <> 'obra' or ci_proyecto_id is not null
  )
);

create index if not exists idx_inv_ubicaciones_tipo on public.inv_ubicaciones (tipo);
create index if not exists idx_inv_ubicaciones_proyecto on public.inv_ubicaciones (ci_proyecto_id)
  where ci_proyecto_id is not null;

comment on table public.inv_ubicaciones is
  'Ubicaciones físicas de stock: almacén central, móvil, obra o virtual (garantías/cuarentena).';

-- Stock por material y ubicación (complementa global_inventory agregado por depósito).
create table if not exists public.inventario_stock (
  id uuid primary key default gen_random_uuid(),
  ubicacion_id uuid not null references public.inv_ubicaciones (id) on delete cascade,
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  cantidad_disponible numeric(15, 4) not null default 0
    check (cantidad_disponible >= 0),
  cantidad_reservada numeric(15, 4) not null default 0
    check (cantidad_reservada >= 0),
  cantidad_en_transito_entrante numeric(15, 4) not null default 0
    check (cantidad_en_transito_entrante >= 0),
  updated_at timestamptz not null default now(),
  constraint inventario_stock_ubicacion_material_unique unique (ubicacion_id, material_id)
);

create index if not exists idx_inventario_stock_material on public.inventario_stock (material_id);

comment on table public.inventario_stock is
  'Stock físico por ubicación y material (SKU en global_inventory).';

-- ── 2. Series / trazabilidad (CCTV, switches, cerraduras, etc.) ─────────────────
create table if not exists public.series_productos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  numero_serie text not null,
  estado text not null default 'en_stock'
    check (estado in (
      'en_stock', 'en_transito', 'en_obra', 'garantia', 'merma', 'baja'
    )),
  ubicacion_id uuid references public.inv_ubicaciones (id) on delete set null,
  ci_proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  compra_linea_id uuid,
  transferencia_linea_id uuid,
  proveedor_nombre text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint series_productos_numero_unique unique (numero_serie)
);

create index if not exists idx_series_productos_material on public.series_productos (material_id);
create index if not exists idx_series_productos_ubicacion on public.series_productos (ubicacion_id);
create index if not exists idx_series_productos_estado on public.series_productos (estado);

-- ── 3. Compras e ingreso a almacén ─────────────────────────────────────────────
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
  updated_at timestamptz not null default now(),
  constraint compras_facturas_numero_proveedor_unique unique (numero_factura, proveedor_rif)
);

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

alter table public.series_productos
  add constraint series_productos_compra_linea_fk
  foreign key (compra_linea_id) references public.compras_factura_lineas (id) on delete set null;

-- ── 4. Techo presupuestario por partida y material ─────────────────────────────
create table if not exists public.obra_partidas_materiales (
  id uuid primary key default gen_random_uuid(),
  ci_proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  partida_id uuid references public.partidas (id) on delete cascade,
  ci_presupuesto_partida_id uuid references public.ci_presupuesto_partidas (id) on delete cascade,
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  cantidad_techo numeric(15, 4) not null default 0 check (cantidad_techo >= 0),
  monto_techo_usd numeric(15, 2),
  unidad text not null default 'UND',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obra_partidas_materiales_partida_xor check (
    partida_id is not null or ci_presupuesto_partida_id is not null
  )
);

create index if not exists idx_obra_partidas_materiales_proyecto
  on public.obra_partidas_materiales (ci_proyecto_id);
create index if not exists idx_obra_partidas_materiales_material
  on public.obra_partidas_materiales (material_id);

-- ── 5. Transferencias y cadena de custodia ─────────────────────────────────────
create table if not exists public.transferencias_inventario (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  tipo_movimiento text not null default 'transferencia'
    check (tipo_movimiento in (
      'transferencia', 'salida_obra', 'retorno_garantia', 'retorno_merma'
    )),
  origen_ubicacion_id uuid not null references public.inv_ubicaciones (id) on delete restrict,
  destino_ubicacion_id uuid not null references public.inv_ubicaciones (id) on delete restrict,
  ci_proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_transito', 'completado', 'rechazado', 'garantia')),
  usuario_despacha_id uuid references auth.users (id) on delete set null,
  usuario_transporta_id uuid references auth.users (id) on delete set null,
  usuario_recibe_id uuid references auth.users (id) on delete set null,
  despachado_at timestamptz,
  recibido_at timestamptz,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transferencias_inventario_codigo_unique unique (codigo),
  constraint transferencias_inventario_origen_destino_distinto check (
    origen_ubicacion_id <> destino_ubicacion_id
  )
);

create index if not exists idx_transferencias_estado on public.transferencias_inventario (estado);
create index if not exists idx_transferencias_proyecto on public.transferencias_inventario (ci_proyecto_id);

create table if not exists public.transferencias_inventario_lineas (
  id uuid primary key default gen_random_uuid(),
  transferencia_id uuid not null references public.transferencias_inventario (id) on delete cascade,
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  cantidad numeric(15, 4) not null check (cantidad > 0),
  cantidad_recibida numeric(15, 4) not null default 0 check (cantidad_recibida >= 0),
  serie_id uuid references public.series_productos (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_transferencias_lineas_transferencia
  on public.transferencias_inventario_lineas (transferencia_id);

alter table public.series_productos
  add constraint series_productos_transferencia_linea_fk
  foreign key (transferencia_linea_id) references public.transferencias_inventario_lineas (id)
  on delete set null;

-- Imputación / prorrateo del material saliente entre partidas de la obra.
create table if not exists public.detalle_transferencia_partidas (
  id uuid primary key default gen_random_uuid(),
  transferencia_linea_id uuid not null
    references public.transferencias_inventario_lineas (id) on delete cascade,
  partida_id uuid references public.partidas (id) on delete set null,
  ci_presupuesto_partida_id uuid references public.ci_presupuesto_partidas (id) on delete set null,
  cantidad_imputada numeric(15, 4) not null check (cantidad_imputada > 0),
  exceso_presupuesto boolean not null default false,
  justificacion_exceso text,
  flagged_sobrecosto boolean not null default false,
  created_at timestamptz not null default now(),
  constraint detalle_transferencia_partidas_partida_xor check (
    partida_id is not null or ci_presupuesto_partida_id is not null
  ),
  constraint detalle_transferencia_exceso_justificado check (
    exceso_presupuesto = false or (
      justificacion_exceso is not null and btrim(justificacion_exceso) <> ''
    )
  )
);

create index if not exists idx_detalle_transferencia_partidas_linea
  on public.detalle_transferencia_partidas (transferencia_linea_id);

-- ── 6. Funciones de stock ──────────────────────────────────────────────────────
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

-- Valida techo presupuestario y marca exceso antes de insertar imputación.
create or replace function public.inv_validar_imputacion_partida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material_id uuid;
  v_techo numeric;
  v_consumido numeric;
  v_proyecto_id uuid;
begin
  select tl.material_id, t.ci_proyecto_id
  into v_material_id, v_proyecto_id
  from public.transferencias_inventario_lineas tl
  join public.transferencias_inventario t on t.id = tl.transferencia_id
  where tl.id = new.transferencia_linea_id;

  if new.partida_id is not null then
    select coalesce(opm.cantidad_techo, 0)
    into v_techo
    from public.obra_partidas_materiales opm
    join public.partidas p on p.id = new.partida_id
    join public.capitulos c on c.id = p.capitulo_id
    where opm.material_id = v_material_id
      and opm.partida_id = new.partida_id
      and (v_proyecto_id is null or opm.ci_proyecto_id = v_proyecto_id)
    limit 1;
  elsif new.ci_presupuesto_partida_id is not null then
    select coalesce(opm.cantidad_techo, 0)
    into v_techo
    from public.obra_partidas_materiales opm
    where opm.material_id = v_material_id
      and opm.ci_presupuesto_partida_id = new.ci_presupuesto_partida_id
      and (v_proyecto_id is null or opm.ci_proyecto_id = v_proyecto_id)
    limit 1;
  else
    raise exception 'Debe indicar partida_id o ci_presupuesto_partida_id';
  end if;

  select coalesce(sum(d.cantidad_imputada), 0)
  into v_consumido
  from public.detalle_transferencia_partidas d
  join public.transferencias_inventario_lineas tl on tl.id = d.transferencia_linea_id
  join public.transferencias_inventario t on t.id = tl.transferencia_id
  where d.id is distinct from new.id
    and tl.material_id = v_material_id
    and (
      (new.partida_id is not null and d.partida_id = new.partida_id)
      or (new.ci_presupuesto_partida_id is not null and d.ci_presupuesto_partida_id = new.ci_presupuesto_partida_id)
    )
    and t.estado in ('pendiente', 'en_transito', 'completado');

  if (v_consumido + new.cantidad_imputada) > coalesce(v_techo, 0) then
    new.exceso_presupuesto := true;
    new.flagged_sobrecosto := true;
    if new.justificacion_exceso is null or btrim(new.justificacion_exceso) = '' then
      raise exception
        'Exceso presupuestario: cantidad imputada % supera techo %. Justificación obligatoria.',
        (v_consumido + new.cantidad_imputada),
        coalesce(v_techo, 0);
    end if;
  else
    new.exceso_presupuesto := false;
    new.flagged_sobrecosto := false;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_inv_validar_imputacion_partida on public.detalle_transferencia_partidas;
create trigger tr_inv_validar_imputacion_partida
  before insert or update on public.detalle_transferencia_partidas
  for each row
  execute function public.inv_validar_imputacion_partida();

-- Al registrar compra: incrementa stock en ubicación destino.
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

-- Transferencia: despacho (en tránsito) y recepción (completado).
create or replace function public.inv_transferencia_estado_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if old.estado = new.estado then
    return new;
  end if;

  if new.estado = 'en_transito' and old.estado = 'pendiente' then
    new.despachado_at := coalesce(new.despachado_at, now());
    for r in
      select material_id, sum(cantidad) as qty
      from public.transferencias_inventario_lineas
      where transferencia_id = new.id
      group by material_id
    loop
      perform public.inv_stock_apply_delta(new.origen_ubicacion_id, r.material_id, -r.qty, 0, 0);
    end loop;
  elsif new.estado = 'completado' and old.estado = 'en_transito' then
    new.recibido_at := coalesce(new.recibido_at, now());
    for r in
      select material_id, sum(cantidad) as qty
      from public.transferencias_inventario_lineas
      where transferencia_id = new.id
      group by material_id
    loop
      perform public.inv_stock_apply_delta(new.destino_ubicacion_id, r.material_id, r.qty, 0, 0);
    end loop;
    -- Series: mover a destino
    update public.series_productos sp
    set
      ubicacion_id = new.destino_ubicacion_id,
      estado = case
        when u.tipo = 'obra' then 'en_obra'
        when u.tipo = 'garantias' then 'garantia'
        else 'en_stock'
      end,
      ci_proyecto_id = coalesce(new.ci_proyecto_id, u.ci_proyecto_id),
      updated_at = now()
    from public.transferencias_inventario_lineas tl
    join public.inv_ubicaciones u on u.id = new.destino_ubicacion_id
    where tl.transferencia_id = new.id
      and sp.id = tl.serie_id;
  elsif new.estado = 'rechazado' and old.estado = 'en_transito' then
    for r in
      select material_id, sum(cantidad) as qty
      from public.transferencias_inventario_lineas
      where transferencia_id = new.id
      group by material_id
    loop
      perform public.inv_stock_apply_delta(new.origen_ubicacion_id, r.material_id, r.qty, 0, 0);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_inv_transferencia_estado_stock on public.transferencias_inventario;
create trigger tr_inv_transferencia_estado_stock
  before update on public.transferencias_inventario
  for each row
  execute function public.inv_transferencia_estado_stock();

-- ── 7. Seed ubicaciones desde depósitos y almacén garantías ───────────────────
insert into public.inv_ubicaciones (codigo, nombre, tipo, deposit_id)
select
  'DEP-' || d.code,
  d.name,
  case when d.is_default then 'almacen_central' else 'almacen_movil' end,
  d.id
from public.inventory_deposits d
where not exists (
  select 1 from public.inv_ubicaciones u where u.deposit_id = d.id
);

insert into public.inv_ubicaciones (codigo, nombre, tipo)
values
  ('GARANTIAS', 'Almacén virtual — Garantías', 'garantias'),
  ('CUARENTENA', 'Cuarentena / control calidad', 'cuarentena')
on conflict (codigo) do nothing;

-- ── 8. RLS (patrón anon del proyecto) ─────────────────────────────────────────
alter table public.inv_ubicaciones enable row level security;
alter table public.inventario_stock enable row level security;
alter table public.series_productos enable row level security;
alter table public.compras_facturas enable row level security;
alter table public.compras_factura_lineas enable row level security;
alter table public.obra_partidas_materiales enable row level security;
alter table public.transferencias_inventario enable row level security;
alter table public.transferencias_inventario_lineas enable row level security;
alter table public.detalle_transferencia_partidas enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'inv_ubicaciones',
    'inventario_stock',
    'series_productos',
    'compras_facturas',
    'compras_factura_lineas',
    'obra_partidas_materiales',
    'transferencias_inventario',
    'transferencias_inventario_lineas',
    'detalle_transferencia_partidas'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%s_select_anon" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert_anon" on public.%I', t, t);
    execute format('drop policy if exists "%s_update_anon" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete_anon" on public.%I', t, t);
    execute format(
      'create policy "%s_select_anon" on public.%I for select to anon using (true)',
      t, t
    );
    execute format(
      'create policy "%s_insert_anon" on public.%I for insert to anon with check (true)',
      t, t
    );
    execute format(
      'create policy "%s_update_anon" on public.%I for update to anon using (true) with check (true)',
      t, t
    );
    execute format(
      'create policy "%s_delete_anon" on public.%I for delete to anon using (true)',
      t, t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
