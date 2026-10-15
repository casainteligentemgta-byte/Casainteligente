-- Aplicada en producción el 2026-10-15.
--
-- ci_registrar_abono_cliente insertaba en columnas que no existen en ci_proyecto_abonos
-- (monto_usd, tasa_bcv, referencia_transferencia), así que nunca pudo registrar un abono:
-- «column "monto_usd" of relation "ci_proyecto_abonos" does not exist».
-- Nombres reales: monto_equivalente_usd, tasa_bcv_fecha (obligatoria), cuenta_referencia.
--
-- Incluye el paso final de 357 para esta función (solo service_role). Las dos firmas de
-- ci_registrar_inyeccion_capital se cerraron el mismo día, tras desplegar el PR #432.
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
declare
  v_id uuid;
  v_monto_ves numeric(18, 2);
begin
  if p_monto_recibido <= 0 or p_monto_usd <= 0 then
    raise exception 'Montos deben ser positivos';
  end if;
  if p_moneda not in ('USD', 'VES') then
    raise exception 'Moneda inválida';
  end if;
  if p_moneda = 'VES' and coalesce(p_tasa_bcv, 0) <= 0 then
    raise exception 'Un abono en bolívares requiere la tasa BCV';
  end if;

  v_monto_ves := case when p_moneda = 'VES' then p_monto_recibido else 0 end;

  insert into public.ci_proyecto_abonos (
    proyecto_id,
    monto_recibido,
    moneda,
    monto_equivalente_usd,
    tasa_bcv_fecha,
    banco_origen,
    cuenta_referencia,
    fecha_abono,
    observaciones
  )
  values (
    p_proyecto_id,
    p_monto_recibido,
    p_moneda,
    p_monto_usd,
    -- La columna es obligatoria; en abonos en USD la tasa no se usa (la pantalla solo la lee en VES).
    coalesce(p_tasa_bcv, 0),
    trim(p_banco_origen),
    trim(p_referencia),
    p_fecha_abono,
    nullif(trim(coalesce(p_observaciones, '')), '')
  )
  returning id into v_id;

  insert into public.ci_proyecto_fondos (
    proyecto_id, saldo_usd, saldo_ves, total_abonado_usd, total_abonado_ves, updated_at
  )
  values (p_proyecto_id, p_monto_usd, v_monto_ves, p_monto_usd, v_monto_ves, now())
  on conflict (proyecto_id) do update set
    saldo_usd = public.ci_proyecto_fondos.saldo_usd + excluded.saldo_usd,
    saldo_ves = public.ci_proyecto_fondos.saldo_ves + excluded.saldo_ves,
    total_abonado_usd = public.ci_proyecto_fondos.total_abonado_usd + excluded.total_abonado_usd,
    total_abonado_ves = public.ci_proyecto_fondos.total_abonado_ves + excluded.total_abonado_ves,
    updated_at = now();

  return v_id;
end;
$function$;

revoke execute on function public.ci_registrar_abono_cliente(uuid, numeric, text, numeric, numeric, text, text, date, text) from public, anon, authenticated;
grant execute on function public.ci_registrar_abono_cliente(uuid, numeric, text, numeric, numeric, text, text, date, text) to service_role;
