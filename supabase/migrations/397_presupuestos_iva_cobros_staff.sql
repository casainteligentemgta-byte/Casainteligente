-- Presupuestos comerciales: IVA, cobros solo vía abonos y staff de cobros.
--
-- - iva_pct (default 16; 0 = exento) e iva_monto. Los ya existentes quedan exentos
--   para no cambiar documentos enviados.
-- - ci_es_staff_cobros: la función que ya corre en producción, versionada aquí.
-- - pagado / cobrado / parcialmente_pagado solo los pone el recálculo de abonos.
-- Idempotente.

-- 1) Staff de cobros (producción ya la tenía; el repo no).
create or replace function public.ci_es_staff_cobros()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or exists (select 1 from public.ci_usuarios_roles ur where ur.user_id = auth.uid());
$$;

comment on function public.ci_es_staff_cobros() is
  '¿La sesión puede registrar o quitar abonos de un presupuesto? Service role o usuario con fila en ci_usuarios_roles.';

revoke all on function public.ci_es_staff_cobros() from public, anon;
grant execute on function public.ci_es_staff_cobros() to authenticated, service_role;

-- 2) Columnas de IVA.
alter table public.budgets
  add column if not exists iva_pct numeric(5, 2),
  add column if not exists iva_monto numeric(14, 2);

update public.budgets
set iva_pct = 0
where iva_pct is null;

update public.budgets
set iva_monto = round(coalesce(subtotal, 0) * coalesce(iva_pct, 0) / 100, 2)
where iva_monto is null;

alter table public.budgets alter column iva_pct set default 16;
alter table public.budgets alter column iva_pct set not null;
alter table public.budgets alter column iva_monto set default 0;
alter table public.budgets alter column iva_monto set not null;

alter table public.budgets drop constraint if exists budgets_iva_pct_rango;
alter table public.budgets add constraint budgets_iva_pct_rango
  check (iva_pct >= 0 and iva_pct <= 100);

alter table public.budgets drop constraint if exists budgets_iva_monto_no_negativo;
alter table public.budgets add constraint budgets_iva_monto_no_negativo
  check (iva_monto >= 0);

comment on column public.budgets.iva_pct is
  'Porcentaje de IVA. 16 por defecto; 0 = exento. El documento muestra el monto y el total con IVA.';
comment on column public.budgets.iva_monto is
  'USD de IVA = round(subtotal * iva_pct / 100, 2). Lo mantiene el disparador al guardar.';

-- 3) Número, fechas, IVA y saldo al insertar/actualizar.
create or replace function public.ci_budgets_fijar_numero_y_fechas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.numero_correlativo := nextval('public.budgets_correlativo_seq');
    new.created_at := now();
    new.updated_at := now();
    new.iva_pct := coalesce(new.iva_pct, 16);
    if new.iva_pct < 0 then new.iva_pct := 0; end if;
    if new.iva_pct > 100 then new.iva_pct := 100; end if;
    new.iva_monto := round(coalesce(new.subtotal, 0) * new.iva_pct / 100, 2);
    new.saldo := greatest(
      round(coalesce(new.subtotal, 0) + coalesce(new.iva_monto, 0) - coalesce(new.monto_pagado, 0), 2),
      0
    );
    return new;
  end if;

  new.numero_correlativo := old.numero_correlativo;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.iva_pct := coalesce(new.iva_pct, old.iva_pct, 16);
  if new.iva_pct < 0 then new.iva_pct := 0; end if;
  if new.iva_pct > 100 then new.iva_pct := 100; end if;
  new.iva_monto := round(coalesce(new.subtotal, 0) * new.iva_pct / 100, 2);
  if new.subtotal is distinct from old.subtotal
     or new.iva_pct is distinct from old.iva_pct
     or new.iva_monto is distinct from old.iva_monto then
    new.saldo := greatest(
      round(coalesce(new.subtotal, 0) + coalesce(new.iva_monto, 0) - coalesce(new.monto_pagado, 0), 2),
      0
    );
  end if;
  return new;
end;
$$;

-- 4) Recalcular cobro: total = subtotal + IVA; marca sesión para el disparador de estado.
create or replace function public.ci_recalcular_cobro_presupuesto(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(14, 2);
  v_pagado numeric(14, 2);
  v_saldo numeric(14, 2);
  v_status text;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Hace falta iniciar sesión';
  end if;

  perform set_config('ci.cobro_presupuesto', '1', true);

  select round(coalesce(subtotal, 0) + coalesce(iva_monto, 0), 2), status
    into v_total, v_status
  from public.budgets
  where id = p_budget_id
  for update;

  if not found then
    raise exception 'Presupuesto no encontrado';
  end if;

  select coalesce(sum(monto_usd), 0) into v_pagado
  from public.budget_abonos
  where budget_id = p_budget_id;

  v_pagado := round(v_pagado, 2);
  v_saldo := greatest(round(v_total - v_pagado, 2), 0);

  if v_pagado <= 0 then
    if v_status in ('pagado', 'parcialmente_pagado') then
      v_status := 'cobrado';
    end if;
  elsif v_pagado + 0.009 >= v_total and v_total > 0 then
    v_status := 'pagado';
  else
    v_status := 'parcialmente_pagado';
  end if;

  update public.budgets
  set
    monto_pagado = v_pagado,
    saldo = v_saldo,
    status = v_status
  where id = p_budget_id;

  update public.budget_cuotas c
  set estado = case
    when c.monto_pagado + 0.009 >= c.monto then 'pagada'
    when c.monto_pagado > 0 then 'parcial'
    else 'pendiente'
  end
  where c.budget_id = p_budget_id;
end;
$$;

create or replace function public.ci_registrar_abono_presupuesto(
  p_budget_id uuid,
  p_monto numeric,
  p_moneda text,
  p_monto_usd numeric,
  p_tasa_bcv numeric,
  p_metodo text,
  p_banco_origen text,
  p_referencia text,
  p_fecha_abono date,
  p_notas text default null,
  p_cuota_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_total numeric(14, 2);
  v_pagado numeric(14, 2);
  v_usd numeric(14, 2);
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Hace falta iniciar sesión';
  end if;
  if not public.ci_es_staff_cobros() then
    raise exception 'Sin permiso para gestionar cobros' using errcode = '42501';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto_usd is null or p_monto_usd <= 0 then
    raise exception 'El monto del abono debe ser positivo';
  end if;
  if p_moneda not in ('USD', 'VES') then
    raise exception 'Moneda inválida';
  end if;
  if p_cuota_id is not null and not exists (
    select 1 from public.budget_cuotas c where c.id = p_cuota_id and c.budget_id = p_budget_id
  ) then
    raise exception 'La cuota no pertenece al presupuesto';
  end if;

  select round(coalesce(subtotal, 0) + coalesce(iva_monto, 0), 2)
    into v_total
  from public.budgets
  where id = p_budget_id
  for update;
  if not found then
    raise exception 'Presupuesto no encontrado';
  end if;

  select coalesce(sum(monto_usd), 0) into v_pagado
  from public.budget_abonos
  where budget_id = p_budget_id;

  v_usd := round(p_monto_usd, 2);
  if v_pagado + v_usd > v_total + 0.009 then
    raise exception 'El abono supera el saldo (saldo $%)', round(greatest(v_total - v_pagado, 0), 2);
  end if;

  insert into public.budget_abonos (
    budget_id, cuota_id, monto, moneda, monto_usd, tasa_bcv,
    metodo, banco_origen, referencia, fecha_abono, notas
  ) values (
    p_budget_id,
    p_cuota_id,
    round(p_monto, 2),
    p_moneda,
    v_usd,
    p_tasa_bcv,
    coalesce(nullif(trim(p_metodo), ''), 'transferencia'),
    nullif(trim(coalesce(p_banco_origen, '')), ''),
    nullif(trim(coalesce(p_referencia, '')), ''),
    p_fecha_abono,
    nullif(trim(coalesce(p_notas, '')), '')
  )
  returning id into v_id;

  perform public.ci_aplicar_abono_a_cuotas(p_budget_id, v_usd, p_cuota_id);
  perform public.ci_recalcular_cobro_presupuesto(p_budget_id);
  return v_id;
end;
$$;

create or replace function public.ci_reaplicar_abonos_presupuesto(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Hace falta iniciar sesión';
  end if;
  if not public.ci_es_staff_cobros() then
    raise exception 'Sin permiso para gestionar cobros' using errcode = '42501';
  end if;
  update public.budget_cuotas set monto_pagado = 0 where budget_id = p_budget_id;
  perform public.ci_aplicar_abono_a_cuotas(
    p_budget_id,
    coalesce((select sum(monto_usd) from public.budget_abonos where budget_id = p_budget_id), 0),
    null
  );
  perform public.ci_recalcular_cobro_presupuesto(p_budget_id);
end;
$$;

-- 5) No se marca pagado/cobrado/parcial a mano.
create or replace function public.ci_budgets_status_solo_abonos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status in ('pagado', 'cobrado', 'parcialmente_pagado')
     and coalesce(current_setting('ci.cobro_presupuesto', true), '') <> '1' then
    raise exception
      'El estado «%» solo se actualiza al registrar o quitar abonos.',
      case new.status
        when 'pagado' then 'Pagado'
        when 'cobrado' then 'Por pagar'
        when 'parcialmente_pagado' then 'Parcial'
        else new.status
      end;
  end if;
  return new;
end;
$$;

drop trigger if exists budgets_status_solo_abonos on public.budgets;
create trigger budgets_status_solo_abonos
  before update of status on public.budgets
  for each row
  execute function public.ci_budgets_status_solo_abonos();

comment on function public.ci_budgets_status_solo_abonos() is
  'Impide UPDATE libre a pagado/cobrado/parcialmente_pagado. Solo ci_recalcular_cobro_presupuesto (ci.cobro_presupuesto=1).';

comment on column public.budgets.saldo is
  'subtotal + iva_monto − monto_pagado (no negativo). Lo recalculan el disparador y los abonos.';

notify pgrst, 'reload schema';
