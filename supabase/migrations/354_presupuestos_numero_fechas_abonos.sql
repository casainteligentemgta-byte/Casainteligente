-- Presupuestos: número fijo, fechas guardadas y abonos.
--
-- Reúne lo que traían las migraciones 020 (número correlativo), 312 (fecha del documento) y
-- 318 (abonos y cuotas), que nunca se aplicaron en producción, con dos cambios:
-- - Abonos y cuotas solo con sesión (318 los dejaba abiertos a cualquiera).
-- - El número y la fecha de creación no se pueden cambiar; la fecha de modificación la pone
--   la base sola; un presupuesto aceptado o con abonos no se puede borrar.
-- Se puede volver a ejecutar sin efecto.

-- 1) Número correlativo: P-500, P-501… por orden de creación (el mismo que ya se mostraba).
create sequence if not exists public.budgets_correlativo_seq start with 500 increment by 1;

alter table public.budgets add column if not exists numero_correlativo bigint;

with ordenados as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.budgets
)
update public.budgets b
set numero_correlativo = 499 + o.rn
from ordenados o
where b.id = o.id and b.numero_correlativo is null;

alter table public.budgets alter column numero_correlativo set not null;

create unique index if not exists idx_budgets_numero_correlativo_unique
  on public.budgets (numero_correlativo);

select setval('public.budgets_correlativo_seq', (select coalesce(max(numero_correlativo), 499) from public.budgets));

comment on column public.budgets.numero_correlativo is
  'Número del presupuesto (P-500, P-501…). Lo pone la base al crearlo y no se puede cambiar.';

-- 2) Fecha del documento (la que se imprime; se puede cambiar). La de creación es created_at.
alter table public.budgets add column if not exists fecha date;

update public.budgets
set fecha = (created_at at time zone 'America/Caracas')::date
where fecha is null and created_at is not null;

alter table public.budgets alter column fecha set default ((now() at time zone 'America/Caracas')::date);

create index if not exists idx_budgets_fecha on public.budgets (fecha desc);

comment on column public.budgets.fecha is
  'Fecha impresa del presupuesto (día en Venezuela). Se puede cambiar al editar; created_at es el alta y no cambia; updated_at es la última modificación.';

-- 3) Abonos y cuotas.
alter table public.budgets
  add column if not exists monto_pagado numeric(14, 2) not null default 0 check (monto_pagado >= 0),
  add column if not exists saldo numeric(14, 2);

update public.budgets
set saldo = greatest(coalesce(subtotal, 0) - coalesce(monto_pagado, 0), 0)
where saldo is null;

create table if not exists public.budget_cuotas (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  numero integer not null check (numero >= 1),
  monto numeric(14, 2) not null check (monto > 0),
  fecha_vencimiento date not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'parcial', 'pagada')),
  monto_pagado numeric(14, 2) not null default 0 check (monto_pagado >= 0),
  notas text,
  created_at timestamptz not null default now(),
  unique (budget_id, numero)
);

create index if not exists idx_budget_cuotas_budget
  on public.budget_cuotas (budget_id, fecha_vencimiento, numero);

create table if not exists public.budget_abonos (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  cuota_id uuid references public.budget_cuotas (id) on delete set null,
  monto numeric(14, 2) not null check (monto > 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'VES')),
  monto_usd numeric(14, 2) not null check (monto_usd > 0),
  tasa_bcv numeric(18, 6),
  metodo text not null default 'transferencia',
  banco_origen text,
  referencia text,
  fecha_abono date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_budget_abonos_budget
  on public.budget_abonos (budget_id, fecha_abono desc, created_at desc);

alter table public.budget_cuotas enable row level security;
alter table public.budget_abonos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'budget_cuotas' and policyname = 'budget_cuotas_con_sesion') then
    create policy budget_cuotas_con_sesion on public.budget_cuotas
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'budget_abonos' and policyname = 'budget_abonos_con_sesion') then
    create policy budget_abonos_con_sesion on public.budget_abonos
      for all to authenticated using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.budget_cuotas to authenticated, service_role;
grant select, insert, update, delete on public.budget_abonos to authenticated, service_role;

-- Las funciones son «security definer»: cada una exige sesión antes de tocar nada.
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
  select coalesce(subtotal, 0), status into v_total, v_status
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

create or replace function public.ci_aplicar_abono_a_cuotas(
  p_budget_id uuid,
  p_monto_usd numeric,
  p_cuota_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restante numeric(14, 2);
  v_cuota record;
  v_aplicar numeric(14, 2);
  v_falta numeric(14, 2);
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Hace falta iniciar sesión';
  end if;
  v_restante := round(coalesce(p_monto_usd, 0), 2);
  if v_restante <= 0 then
    return;
  end if;

  if p_cuota_id is not null then
    select * into v_cuota
    from public.budget_cuotas
    where id = p_cuota_id and budget_id = p_budget_id
    for update;
    if found then
      v_falta := greatest(round(v_cuota.monto - v_cuota.monto_pagado, 2), 0);
      v_aplicar := least(v_restante, v_falta);
      if v_aplicar > 0 then
        update public.budget_cuotas
        set monto_pagado = round(monto_pagado + v_aplicar, 2)
        where id = v_cuota.id;
      end if;
    end if;
    return;
  end if;

  for v_cuota in
    select *
    from public.budget_cuotas
    where budget_id = p_budget_id
      and monto_pagado + 0.009 < monto
    order by fecha_vencimiento, numero
    for update
  loop
    exit when v_restante <= 0;
    v_falta := greatest(round(v_cuota.monto - v_cuota.monto_pagado, 2), 0);
    v_aplicar := least(v_restante, v_falta);
    if v_aplicar > 0 then
      update public.budget_cuotas
      set monto_pagado = round(monto_pagado + v_aplicar, 2)
      where id = v_cuota.id;
      v_restante := round(v_restante - v_aplicar, 2);
    end if;
  end loop;
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
  if p_monto is null or p_monto <= 0 or p_monto_usd is null or p_monto_usd <= 0 then
    raise exception 'El monto del abono debe ser positivo';
  end if;
  if p_moneda not in ('USD', 'VES') then
    raise exception 'Moneda inválida';
  end if;

  select coalesce(subtotal, 0) into v_total
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

-- Tras quitar un abono (lo hace la app sobre la tabla), vuelve a repartir lo cobrado
-- entre las cuotas y recalcula saldo y estado.
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
  update public.budget_cuotas set monto_pagado = 0 where budget_id = p_budget_id;
  perform public.ci_aplicar_abono_a_cuotas(
    p_budget_id,
    coalesce((select sum(monto_usd) from public.budget_abonos where budget_id = p_budget_id), 0),
    null
  );
  perform public.ci_recalcular_cobro_presupuesto(p_budget_id);
end;
$$;

grant execute on function public.ci_recalcular_cobro_presupuesto(uuid) to authenticated, service_role;
grant execute on function public.ci_aplicar_abono_a_cuotas(uuid, numeric, uuid) to authenticated, service_role;
grant execute on function public.ci_registrar_abono_presupuesto(uuid, numeric, text, numeric, numeric, text, text, text, date, text, uuid)
  to authenticated, service_role;
grant execute on function public.ci_reaplicar_abonos_presupuesto(uuid) to authenticated, service_role;

-- Un abono inicial por cada presupuesto ya marcado como pagado (no tenían historial).
insert into public.budget_abonos (budget_id, monto, moneda, monto_usd, metodo, fecha_abono, notas)
select
  b.id,
  greatest(coalesce(b.subtotal, 0), 0.01),
  'USD',
  greatest(coalesce(b.subtotal, 0), 0.01),
  'otro',
  coalesce(b.fecha, b.created_at::date, current_date),
  'Abono inicial: el presupuesto ya estaba marcado como pagado'
from public.budgets b
where b.status = 'pagado'
  and coalesce(b.subtotal, 0) > 0
  and not exists (select 1 from public.budget_abonos a where a.budget_id = b.id);

update public.budgets b
set monto_pagado = coalesce((select round(sum(a.monto_usd), 2) from public.budget_abonos a where a.budget_id = b.id), 0),
    saldo = greatest(round(coalesce(b.subtotal, 0) - coalesce((select sum(a.monto_usd) from public.budget_abonos a where a.budget_id = b.id), 0), 2), 0);

comment on table public.budget_abonos is
  'Abonos (pagos parciales o totales) del cliente sobre un presupuesto.';
comment on table public.budget_cuotas is
  'Plan de cuotas del presupuesto. Los abonos se aplican en orden o a una cuota concreta.';
comment on column public.budgets.monto_pagado is
  'Suma de abonos en USD. La recalcula ci_recalcular_cobro_presupuesto.';
comment on column public.budgets.saldo is
  'subtotal - monto_pagado (no negativo).';

-- El estado «parcialmente_pagado» (pago parcial) faltaba en la regla de estados.
alter table public.budgets drop constraint if exists budgets_status_check;
alter table public.budgets add constraint budgets_status_check
  check (status in ('no_enviado', 'enviado', 'aprobado', 'no_aprobado', 'cobrado', 'parcialmente_pagado', 'pagado'));

-- 4) Lo que no se puede cambiar ni borrar.
create or replace function public.ci_budgets_fijar_numero_y_fechas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- El número lo pone la base, siempre el siguiente; nadie lo elige.
    new.numero_correlativo := nextval('public.budgets_correlativo_seq');
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  -- Al modificar: el número y la fecha de creación no cambian; la de modificación sí.
  new.numero_correlativo := old.numero_correlativo;
  new.created_at := old.created_at;
  new.updated_at := now();
  -- Si cambia el total de un presupuesto con abonos, el saldo sigue al total nuevo.
  if new.subtotal is distinct from old.subtotal then
    new.saldo := greatest(round(coalesce(new.subtotal, 0) - coalesce(new.monto_pagado, 0), 2), 0);
  end if;
  return new;
end;
$$;

create or replace function public.ci_budgets_no_borrar_aceptados()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('aprobado', 'cobrado', 'parcialmente_pagado', 'pagado') then
    raise exception 'No se puede eliminar el presupuesto P-%: el cliente ya lo aceptó. Si se anuló, márcalo «No aprobado».', old.numero_correlativo;
  end if;
  if exists (select 1 from public.budget_abonos a where a.budget_id = old.id) then
    raise exception 'No se puede eliminar el presupuesto P-%: tiene abonos registrados.', old.numero_correlativo;
  end if;
  return old;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'budgets_numero_alta') then
    create trigger budgets_numero_alta before insert on public.budgets
      for each row execute function public.ci_budgets_fijar_numero_y_fechas();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'budgets_numero_cambio') then
    create trigger budgets_numero_cambio before update on public.budgets
      for each row execute function public.ci_budgets_fijar_numero_y_fechas();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'budgets_no_borrar_aceptados') then
    create trigger budgets_no_borrar_aceptados before delete on public.budgets
      for each row execute function public.ci_budgets_no_borrar_aceptados();
  end if;
end $$;

notify pgrst, 'reload schema';
