-- Fase 1 unificación almacén: ledger append-only + estado logístico en líneas de factura.
-- Fuente de verdad stock: inventario_stock (actualizado vía inv_stock_apply_delta).
-- Trazabilidad: inv_movimientos (cada delta queda registrado).

-- ── Estado logístico en línea (complementa quality_inspections; destino Fase 2) ──
alter table public.purchase_details
  add column if not exists estado_logistica_linea text not null default 'pendiente_cuarentena'
    check (
      estado_logistica_linea in (
        'pendiente_cuarentena',
        'aprobada',
        'rechazada',
        'en_almacen'
      )
    );

alter table public.purchase_details
  add column if not exists motivo_rechazo_linea text;

alter table public.purchase_details
  add column if not exists liberada_at timestamptz;

comment on column public.purchase_details.estado_logistica_linea is
  'Estado unificado de la línea: cuarentena → almacén. Sincronizado con quality_inspections.';
comment on column public.purchase_details.motivo_rechazo_linea is
  'Motivo si estado_logistica_linea = rechazada.';
comment on column public.purchase_details.liberada_at is
  'Timestamp de aprobación/ingreso a stock de la línea.';

create index if not exists idx_purchase_details_estado_logistica
  on public.purchase_details (invoice_id, estado_logistica_linea);

-- ── Ledger de movimientos (append-only) ─────────────────────────────────────────
create table if not exists public.inv_movimientos (
  id uuid primary key default gen_random_uuid(),
  ubicacion_id uuid not null references public.inv_ubicaciones (id) on delete restrict,
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  delta_disponible numeric(15, 4) not null default 0,
  delta_reservada numeric(15, 4) not null default 0,
  delta_transito_entrante numeric(15, 4) not null default 0,
  tipo_movimiento text not null default 'ajuste'
    check (
      tipo_movimiento in (
        'ingreso_compra',
        'transferencia_salida',
        'transferencia_entrada',
        'recepcion_campo',
        'salida_obra',
        'ajuste',
        'anulacion'
      )
    ),
  referencia_tipo text,
  referencia_id uuid,
  documento_id uuid,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_movimientos_ubicacion_material
  on public.inv_movimientos (ubicacion_id, material_id, created_at desc);
create index if not exists idx_inv_movimientos_documento
  on public.inv_movimientos (documento_id)
  where documento_id is not null;
create index if not exists idx_inv_movimientos_referencia
  on public.inv_movimientos (referencia_tipo, referencia_id)
  where referencia_id is not null;

comment on table public.inv_movimientos is
  'Ledger append-only de deltas de stock. Paralelo a inventario_stock; no reemplaza saldos aún.';

alter table public.inv_movimientos enable row level security;

drop policy if exists "inv_movimientos_select_anon" on public.inv_movimientos;
drop policy if exists "inv_movimientos_insert_anon" on public.inv_movimientos;
drop policy if exists "inv_movimientos_select_authenticated" on public.inv_movimientos;
drop policy if exists "inv_movimientos_insert_authenticated" on public.inv_movimientos;

create policy "inv_movimientos_select_anon"
  on public.inv_movimientos for select to anon using (true);
create policy "inv_movimientos_insert_anon"
  on public.inv_movimientos for insert to anon with check (true);
create policy "inv_movimientos_select_authenticated"
  on public.inv_movimientos for select to authenticated using (true);
create policy "inv_movimientos_insert_authenticated"
  on public.inv_movimientos for insert to authenticated with check (true);

-- ── inv_stock_apply_delta: aplica saldo + registra en ledger ───────────────────
create or replace function public.inv_stock_apply_delta(
  p_ubicacion_id uuid,
  p_material_id uuid,
  p_delta_disponible numeric default 0,
  p_delta_reservada numeric default 0,
  p_delta_transito_entrante numeric default 0,
  p_tipo_movimiento text default 'ajuste',
  p_referencia_tipo text default null,
  p_referencia_id uuid default null,
  p_documento_id uuid default null,
  p_notas text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
begin
  v_tipo := coalesce(nullif(btrim(p_tipo_movimiento), ''), 'ajuste');
  if v_tipo not in (
    'ingreso_compra', 'transferencia_salida', 'transferencia_entrada',
    'recepcion_campo', 'salida_obra', 'ajuste', 'anulacion'
  ) then
    v_tipo := 'ajuste';
  end if;

  if coalesce(p_delta_disponible, 0) <> 0
     or coalesce(p_delta_reservada, 0) <> 0
     or coalesce(p_delta_transito_entrante, 0) <> 0 then
    insert into public.inv_movimientos (
      ubicacion_id,
      material_id,
      delta_disponible,
      delta_reservada,
      delta_transito_entrante,
      tipo_movimiento,
      referencia_tipo,
      referencia_id,
      documento_id,
      notas
    ) values (
      p_ubicacion_id,
      p_material_id,
      coalesce(p_delta_disponible, 0),
      coalesce(p_delta_reservada, 0),
      coalesce(p_delta_transito_entrante, 0),
      v_tipo,
      nullif(btrim(p_referencia_tipo), ''),
      p_referencia_id,
      p_documento_id,
      nullif(btrim(p_notas), '')
    );
  end if;

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

-- ── Sincronizar quality_inspections → purchase_details ─────────────────────────
create or replace function public.sync_purchase_detail_estado_logistica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_detail_id uuid;
  v_estado text;
begin
  v_detail_id := coalesce(new.purchase_detail_id, old.purchase_detail_id);
  if v_detail_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  v_estado := case upper(coalesce(new.status, ''))
    when 'PENDIENTE' then 'pendiente_cuarentena'
    when 'APROBADO' then 'en_almacen'
    when 'RECHAZADO' then 'rechazada'
    else 'pendiente_cuarentena'
  end;

  update public.purchase_details
  set
    estado_logistica_linea = v_estado,
    motivo_rechazo_linea = case
      when v_estado = 'rechazada' then coalesce(new.remarks, motivo_rechazo_linea)
      else motivo_rechazo_linea
    end,
    liberada_at = case
      when v_estado in ('en_almacen', 'aprobada') then coalesce(new.inspected_at, liberada_at, now())
      else liberada_at
    end
  where id = v_detail_id;

  return new;
end;
$$;

drop trigger if exists tr_sync_purchase_detail_estado_logistica on public.quality_inspections;
create trigger tr_sync_purchase_detail_estado_logistica
  after insert or update of status, remarks, inspected_at on public.quality_inspections
  for each row execute function public.sync_purchase_detail_estado_logistica();

-- Backfill estado en líneas existentes
update public.purchase_details pd
set
  estado_logistica_linea = case upper(coalesce(qi.status, ''))
    when 'PENDIENTE' then 'pendiente_cuarentena'
    when 'APROBADO' then 'en_almacen'
    when 'RECHAZADO' then 'rechazada'
    else pd.estado_logistica_linea
  end,
  motivo_rechazo_linea = coalesce(qi.remarks, pd.motivo_rechazo_linea),
  liberada_at = coalesce(qi.inspected_at, pd.liberada_at)
from public.quality_inspections qi
where qi.purchase_detail_id = pd.id;

notify pgrst, 'reload schema';
