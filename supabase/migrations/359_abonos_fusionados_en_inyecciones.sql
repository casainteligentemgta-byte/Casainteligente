-- Un solo registro de dinero que entra a la obra: ci_inyecciones_capital.
-- Aplicada en producción el 2026-10-15.
--
-- Antes había dos: inyecciones (Contabilidad, cuentan en el CCO) y abonos del cliente
-- (Finanzas del proyecto, no cuentan en el CCO). Los abonos nunca llegaron a guardarse
-- (358) y ci_proyecto_abonos está vacía. Desde ahora «Registrar abono» crea una
-- inyección con origen «Cliente». Los cobros de Presupuestos (budget_abonos) son otra
-- cosa y no se tocan.
--
-- El saldo de ci_proyecto_fondos (saldo_* y total_abonado_*) se sumaba a mano en cada
-- registro, así que las inyecciones importadas del CCO no estaban (USD 55.000 contra
-- unos USD 722.000). Ahora se recalcula desde las inyecciones con un trigger.
-- saldo_actual_* (caja que descuenta la liquidación de maquinaria) no se toca.

-- 1) Recalcular los fondos de una obra desde sus inyecciones.
create or replace function public.ci_recalcular_fondos_proyecto(p_proyecto_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_proyecto_id is null then
    return;
  end if;

  insert into public.ci_proyecto_fondos (
    proyecto_id, saldo_usd, saldo_ves, total_abonado_usd, total_abonado_ves, updated_at
  )
  select
    p_proyecto_id,
    coalesce(sum(i.monto_usd), 0),
    coalesce(sum(i.monto_ves), 0),
    coalesce(sum(i.monto_usd), 0),
    coalesce(sum(i.monto_ves), 0),
    now()
  from public.ci_inyecciones_capital i
  where i.proyecto_id = p_proyecto_id
  on conflict (proyecto_id) do update set
    saldo_usd = excluded.saldo_usd,
    saldo_ves = excluded.saldo_ves,
    total_abonado_usd = excluded.total_abonado_usd,
    total_abonado_ves = excluded.total_abonado_ves,
    updated_at = now();
end;
$$;

revoke execute on function public.ci_recalcular_fondos_proyecto(uuid) from public, anon, authenticated;
grant execute on function public.ci_recalcular_fondos_proyecto(uuid) to service_role;

-- 2) Trigger: cualquier alta, cambio o baja de inyección recalcula su obra.
create or replace function public.tg_ci_inyecciones_recalcular_fondos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ci_recalcular_fondos_proyecto(old.proyecto_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and (tg_op = 'INSERT' or new.proyecto_id is distinct from old.proyecto_id
          or new.monto_usd is distinct from old.monto_usd
          or new.monto_ves is distinct from old.monto_ves) then
    perform public.ci_recalcular_fondos_proyecto(new.proyecto_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.tg_ci_inyecciones_recalcular_fondos() from public, anon, authenticated;

create or replace trigger tr_ci_inyecciones_recalcular_fondos
  after insert or update or delete on public.ci_inyecciones_capital
  for each row execute function public.tg_ci_inyecciones_recalcular_fondos();

-- 3) La función de registro ya no suma a mano a los fondos (lo hace el trigger).
create or replace function public.ci_registrar_inyeccion_capital(
  p_proyecto_id uuid,
  p_origen_fondo text,
  p_monto_recibido numeric,
  p_moneda text,
  p_tasa_bcv numeric,
  p_tasa_aplicada numeric,
  p_tipo_tasa text,
  p_metodo_pago text,
  p_banco_origen text default null,
  p_cuenta_destino text default null,
  p_referencia text default null,
  p_soporte_path text default null,
  p_seriales jsonb default '[]'::jsonb,
  p_creado_por text default null,
  p_fecha_ingreso date default current_date
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_monto_usd numeric(18, 2);
  v_monto_ves numeric(18, 2);
begin
  if p_monto_recibido <= 0 or p_tasa_aplicada <= 0 then
    raise exception 'Montos y tasa deben ser positivos';
  end if;
  if p_moneda not in ('USD', 'VES') then
    raise exception 'Moneda inválida';
  end if;
  if p_tipo_tasa not in ('BCV', 'PERSONALIZADA') then
    raise exception 'Tipo de tasa inválido';
  end if;
  if p_metodo_pago not in ('TRANSFERENCIA', 'EFECTIVO') then
    raise exception 'Método de pago inválido';
  end if;
  if nullif(trim(coalesce(p_origen_fondo, '')), '') is null then
    raise exception 'Indique origen del fondo';
  end if;
  if p_fecha_ingreso is null then
    raise exception 'Indique fecha de ingreso';
  end if;

  if p_moneda = 'USD' then
    v_monto_usd := round(p_monto_recibido, 2);
    v_monto_ves := round(p_monto_recibido * p_tasa_aplicada, 2);
  else
    v_monto_ves := round(p_monto_recibido, 2);
    v_monto_usd := round(p_monto_recibido / p_tasa_aplicada, 2);
  end if;

  insert into public.ci_inyecciones_capital (
    proyecto_id, origen_fondo, monto_recibido, moneda_recibida, monto_usd, monto_ves,
    tasa_bcv, tasa_aplicada, tipo_tasa, metodo_pago, banco_origen, cuenta_bancaria_destino,
    referencia_bancaria, soporte_storage_path, seriales_billetes, creado_por, fecha_ingreso
  )
  values (
    p_proyecto_id, trim(p_origen_fondo), p_monto_recibido, p_moneda, v_monto_usd, v_monto_ves,
    p_tasa_bcv, p_tasa_aplicada, p_tipo_tasa, p_metodo_pago,
    nullif(trim(coalesce(p_banco_origen, '')), ''),
    nullif(trim(coalesce(p_cuenta_destino, '')), ''),
    nullif(trim(coalesce(p_referencia, '')), ''),
    nullif(trim(coalesce(p_soporte_path, '')), ''),
    coalesce(p_seriales, '[]'::jsonb),
    nullif(trim(coalesce(p_creado_por, '')), ''),
    p_fecha_ingreso
  )
  returning id into v_id;

  -- Los fondos de la obra los recalcula tr_ci_inyecciones_recalcular_fondos.
  return v_id;
end;
$function$;

-- 4) La función de abonos queda deshabilitada: todo ingreso es una inyección.
create or replace function public.ci_registrar_abono_cliente(
  p_proyecto_id uuid,
  p_monto_recibido numeric,
  p_moneda text,
  p_monto_usd numeric,
  p_tasa_bcv numeric,
  p_banco_origen text,
  p_referencia text,
  p_fecha_abono date,
  p_observaciones text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  raise exception 'Los abonos del cliente se registran como inyección de capital (origen Cliente).';
end;
$function$;

comment on table public.ci_proyecto_abonos is
  'En desuso desde 2026-10-15 (migración 359): los abonos del cliente se registran en ci_inyecciones_capital con origen «Cliente».';

-- 5) Recalcular hoy todas las obras con inyecciones o con fila de fondos.
select public.ci_recalcular_fondos_proyecto(x.proyecto_id)
from (
  select distinct proyecto_id from public.ci_inyecciones_capital
  union
  select proyecto_id from public.ci_proyecto_fondos
) x;
