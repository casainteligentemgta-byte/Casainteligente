-- Fecha real del depósito (tasa BCV del día del ingreso, no del registro).

alter table public.ci_inyecciones_capital
  add column if not exists fecha_ingreso date;

update public.ci_inyecciones_capital
set fecha_ingreso = (creado_al at time zone 'America/Caracas')::date
where fecha_ingreso is null;

alter table public.ci_inyecciones_capital
  alter column fecha_ingreso set default (current_date);

comment on column public.ci_inyecciones_capital.fecha_ingreso is
  'Día del ingreso al banco o caja; la tasa BCV referencial es la de esta fecha.';

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
set search_path = public
as $$
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
    proyecto_id,
    origen_fondo,
    monto_recibido,
    moneda_recibida,
    monto_usd,
    monto_ves,
    tasa_bcv,
    tasa_aplicada,
    tipo_tasa,
    metodo_pago,
    banco_origen,
    cuenta_bancaria_destino,
    referencia_bancaria,
    soporte_storage_path,
    seriales_billetes,
    creado_por,
    fecha_ingreso
  )
  values (
    p_proyecto_id,
    trim(p_origen_fondo),
    p_monto_recibido,
    p_moneda,
    v_monto_usd,
    v_monto_ves,
    p_tasa_bcv,
    p_tasa_aplicada,
    p_tipo_tasa,
    p_metodo_pago,
    nullif(trim(coalesce(p_banco_origen, '')), ''),
    nullif(trim(coalesce(p_cuenta_destino, '')), ''),
    nullif(trim(coalesce(p_referencia, '')), ''),
    nullif(trim(coalesce(p_soporte_path, '')), ''),
    coalesce(p_seriales, '[]'::jsonb),
    nullif(trim(coalesce(p_creado_por, '')), ''),
    p_fecha_ingreso
  )
  returning id into v_id;

  insert into public.ci_proyecto_fondos (
    proyecto_id,
    saldo_usd,
    saldo_ves,
    total_abonado_usd,
    total_abonado_ves,
    updated_at
  )
  values (
    p_proyecto_id,
    v_monto_usd,
    v_monto_ves,
    v_monto_usd,
    v_monto_ves,
    now()
  )
  on conflict (proyecto_id) do update set
    saldo_usd = public.ci_proyecto_fondos.saldo_usd + excluded.saldo_usd,
    saldo_ves = public.ci_proyecto_fondos.saldo_ves + excluded.saldo_ves,
    total_abonado_usd = public.ci_proyecto_fondos.total_abonado_usd + excluded.total_abonado_usd,
    total_abonado_ves = public.ci_proyecto_fondos.total_abonado_ves + excluded.total_abonado_ves,
    updated_at = now();

  return v_id;
end;
$$;

grant execute on function public.ci_registrar_inyeccion_capital(
  uuid, text, numeric, text, numeric, numeric, text, text, text, text, text, text, jsonb, text, date
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
