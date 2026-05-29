-- Contrato Administración Delegada (AD), abonos bimonetarios del cliente y fondos consolidados.

-- Extender ci_contratos_express para AD sin romper contratos obrero existentes.
alter table public.ci_contratos_express
  add column if not exists tipo_contrato text not null default 'obrero_express',
  add column if not exists entidad_ejecutora_id uuid references public.ci_entidades (id) on delete set null,
  add column if not exists honorarios_admin_pct numeric(5, 2)
    check (honorarios_admin_pct is null or (honorarios_admin_pct >= 0 and honorarios_admin_pct <= 100)),
  add column if not exists estado text not null default 'registrado';

comment on column public.ci_contratos_express.tipo_contrato is
  'obrero_express | administracion_delegada';
comment on column public.ci_contratos_express.estado is
  'borrador | registrado | exitoso — AD requiere exitoso para habilitar logística del proyecto.';

alter table public.ci_contratos_express
  alter column obrero_nombre drop not null,
  alter column obrero_cedula drop not null,
  alter column pdf_storage_path drop not null;

create index if not exists idx_ci_contratos_express_tipo_estado
  on public.ci_contratos_express (proyecto_id, tipo_contrato, estado);

-- Fondos consolidados por proyecto (capital del cliente).
create table if not exists public.ci_proyecto_fondos (
  proyecto_id uuid primary key references public.ci_proyectos (id) on delete cascade,
  saldo_usd numeric(18, 2) not null default 0,
  saldo_ves numeric(18, 2) not null default 0,
  total_abonado_usd numeric(18, 2) not null default 0,
  total_abonado_ves numeric(18, 2) not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.ci_proyecto_fondos is
  'Saldo consolidado de abonos del cliente por proyecto (USD y VES).';

-- Abonos / ingresos de capital del cliente.
create table if not exists public.ci_proyecto_abonos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  monto_recibido numeric(18, 2) not null check (monto_recibido > 0),
  moneda text not null check (moneda in ('USD', 'VES')),
  monto_usd numeric(18, 2) not null check (monto_usd > 0),
  tasa_bcv numeric(18, 6),
  banco_origen text not null,
  referencia_transferencia text not null,
  fecha_abono date not null,
  observaciones text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_proyecto_abonos_proyecto
  on public.ci_proyecto_abonos (proyecto_id, fecha_abono desc);

alter table public.ci_proyecto_fondos enable row level security;
alter table public.ci_proyecto_abonos enable row level security;

drop policy if exists "ci_proyecto_fondos_all_anon" on public.ci_proyecto_fondos;
create policy "ci_proyecto_fondos_all_anon" on public.ci_proyecto_fondos
  for all to anon using (true) with check (true);

drop policy if exists "ci_proyecto_abonos_all_anon" on public.ci_proyecto_abonos;
create policy "ci_proyecto_abonos_all_anon" on public.ci_proyecto_abonos
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.ci_proyecto_fondos to anon, authenticated, service_role;
grant select, insert, update, delete on public.ci_proyecto_abonos to anon, authenticated, service_role;

-- Transacción: inserta abono y actualiza fondos consolidados.
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
set search_path = public
as $$
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

  v_monto_ves := case when p_moneda = 'VES' then p_monto_recibido else 0 end;

  insert into public.ci_proyecto_abonos (
    proyecto_id,
    monto_recibido,
    moneda,
    monto_usd,
    tasa_bcv,
    banco_origen,
    referencia_transferencia,
    fecha_abono,
    observaciones
  )
  values (
    p_proyecto_id,
    p_monto_recibido,
    p_moneda,
    p_monto_usd,
    p_tasa_bcv,
    trim(p_banco_origen),
    trim(p_referencia),
    p_fecha_abono,
    nullif(trim(coalesce(p_observaciones, '')), '')
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
    p_monto_usd,
    v_monto_ves,
    p_monto_usd,
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

grant execute on function public.ci_registrar_abono_cliente(
  uuid, numeric, text, numeric, numeric, text, text, date, text
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
