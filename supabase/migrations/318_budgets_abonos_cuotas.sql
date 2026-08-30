-- Abonos libres y cuotas planificadas sobre presupuestos comerciales (budgets).

alter table public.budgets
  add column if not exists monto_pagado numeric(14, 2) not null default 0
    check (monto_pagado >= 0),
  add column if not exists saldo numeric(14, 2);

update public.budgets
set
  monto_pagado = case when status = 'pagado' then coalesce(subtotal, 0) else coalesce(monto_pagado, 0) end,
  saldo = greatest(coalesce(subtotal, 0) - case when status = 'pagado' then coalesce(subtotal, 0) else coalesce(monto_pagado, 0) end, 0);

alter table public.budgets
  drop constraint if exists budgets_status_check;

alter table public.budgets
  add constraint budgets_status_check
  check (status in (
    'no_enviado',
    'enviado',
    'aprobado',
    'no_aprobado',
    'cobrado',
    'parcialmente_pagado',
    'pagado'
  ));

create table if not exists public.budget_cuotas (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  numero integer not null check (numero >= 1),
  monto numeric(14, 2) not null check (monto > 0),
  fecha_vencimiento date not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'parcial', 'pagada')),
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

drop policy if exists "Permitir leer budget_cuotas" on public.budget_cuotas;
create policy "Permitir leer budget_cuotas"
  on public.budget_cuotas for select to anon using (true);
drop policy if exists "Permitir insertar budget_cuotas" on public.budget_cuotas;
create policy "Permitir insertar budget_cuotas"
  on public.budget_cuotas for insert to anon with check (true);
drop policy if exists "Permitir actualizar budget_cuotas" on public.budget_cuotas;
create policy "Permitir actualizar budget_cuotas"
  on public.budget_cuotas for update to anon using (true) with check (true);
drop policy if exists "Permitir borrar budget_cuotas" on public.budget_cuotas;
create policy "Permitir borrar budget_cuotas"
  on public.budget_cuotas for delete to anon using (true);

drop policy if exists "Permitir leer budget_abonos" on public.budget_abonos;
create policy "Permitir leer budget_abonos"
  on public.budget_abonos for select to anon using (true);
drop policy if exists "Permitir insertar budget_abonos" on public.budget_abonos;
create policy "Permitir insertar budget_abonos"
  on public.budget_abonos for insert to anon with check (true);
drop policy if exists "Permitir actualizar budget_abonos" on public.budget_abonos;
create policy "Permitir actualizar budget_abonos"
  on public.budget_abonos for update to anon using (true) with check (true);
drop policy if exists "Permitir borrar budget_abonos" on public.budget_abonos;
create policy "Permitir borrar budget_abonos"
  on public.budget_abonos for delete to anon using (true);

drop policy if exists "Permitir leer budget_cuotas authenticated" on public.budget_cuotas;
create policy "Permitir leer budget_cuotas authenticated"
  on public.budget_cuotas for select to authenticated using (true);
drop policy if exists "Permitir escribir budget_cuotas authenticated" on public.budget_cuotas;
create policy "Permitir escribir budget_cuotas authenticated"
  on public.budget_cuotas for all to authenticated using (true) with check (true);

drop policy if exists "Permitir leer budget_abonos authenticated" on public.budget_abonos;
create policy "Permitir leer budget_abonos authenticated"
  on public.budget_abonos for select to authenticated using (true);
drop policy if exists "Permitir escribir budget_abonos authenticated" on public.budget_abonos;
create policy "Permitir escribir budget_abonos authenticated"
  on public.budget_abonos for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.budget_cuotas to anon, authenticated, service_role;
grant select, insert, update, delete on public.budget_abonos to anon, authenticated, service_role;

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
    status = v_status,
    updated_at = now()
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

create or replace function public.ci_eliminar_abono_presupuesto(p_abono_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget uuid;
begin
  select budget_id into v_budget from public.budget_abonos where id = p_abono_id;
  if v_budget is null then
    raise exception 'Abono no encontrado';
  end if;
  delete from public.budget_abonos where id = p_abono_id;
  -- Recalcula cuotas desde cero a partir de los abonos restantes.
  update public.budget_cuotas set monto_pagado = 0 where budget_id = v_budget;
  perform public.ci_aplicar_abono_a_cuotas(
    v_budget,
    coalesce((select sum(monto_usd) from public.budget_abonos where budget_id = v_budget), 0),
    null
  );
  perform public.ci_recalcular_cobro_presupuesto(v_budget);
end;
$$;

grant execute on function public.ci_recalcular_cobro_presupuesto(uuid) to anon, authenticated, service_role;
grant execute on function public.ci_aplicar_abono_a_cuotas(uuid, numeric, uuid) to anon, authenticated, service_role;
grant execute on function public.ci_registrar_abono_presupuesto(uuid, numeric, text, numeric, numeric, text, text, text, date, text, uuid)
  to anon, authenticated, service_role;
grant execute on function public.ci_eliminar_abono_presupuesto(uuid) to anon, authenticated, service_role;

-- Un abono histórico por presupuestos ya marcados como pagados (sin historial).
insert into public.budget_abonos (budget_id, monto, moneda, monto_usd, metodo, fecha_abono, notas)
select
  b.id,
  greatest(coalesce(b.subtotal, 0), 0.01),
  'USD',
  greatest(coalesce(b.subtotal, 0), 0.01),
  'otro',
  coalesce(b.fecha, b.created_at::date, current_date),
  'Abono inicial: presupuesto ya estaba marcado como pagado'
from public.budgets b
where b.status = 'pagado'
  and coalesce(b.subtotal, 0) > 0
  and not exists (select 1 from public.budget_abonos a where a.budget_id = b.id);

do $$
declare
  r record;
begin
  for r in select id from public.budgets where status = 'pagado' loop
    perform public.ci_recalcular_cobro_presupuesto(r.id);
  end loop;
end $$;

comment on table public.budget_abonos is
  'Abonos libres (parciales) del cliente sobre un presupuesto comercial.';
comment on table public.budget_cuotas is
  'Plan de cuotas del presupuesto. Los abonos se aplican FIFO o a una cuota concreta.';
comment on column public.budgets.monto_pagado is
  'Suma de abonos en USD. Se actualiza con ci_recalcular_cobro_presupuesto.';
comment on column public.budgets.saldo is
  'subtotal - monto_pagado (no negativo).';

notify pgrst, 'reload schema';
