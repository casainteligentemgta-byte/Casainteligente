-- Liquidación intercompany de horas de maquinaria (cierre de ciclo + débito fondo proyecto).

create table if not exists public.ci_maquinaria_liquidaciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete restrict,
  entidad_origen_id uuid references public.ci_entidades (id) on delete set null,
  entidad_destino_id uuid references public.ci_entidades (id) on delete set null,
  monto_total_usd numeric(18, 2) not null default 0 check (monto_total_usd >= 0),
  monto_total_ves numeric(18, 2) not null default 0 check (monto_total_ves >= 0),
  tasa_bcv_aplicada numeric(18, 6) not null check (tasa_bcv_aplicada > 0),
  periodo_desde date not null,
  periodo_hasta date not null,
  created_at timestamptz not null default now(),
  check (periodo_hasta >= periodo_desde)
);

comment on table public.ci_maquinaria_liquidaciones is
  'Cierre intercompany de horas de maquinaria imputadas a obra (origen ejecutor → propietario equipo).';

create index if not exists idx_ci_maquinaria_liquidaciones_proyecto
  on public.ci_maquinaria_liquidaciones (proyecto_id, periodo_desde desc);

alter table public.ci_maquinaria_control_horas
  add column if not exists estado_liquidacion text not null default 'pendiente',
  add column if not exists liquidacion_id uuid references public.ci_maquinaria_liquidaciones (id) on delete set null;

alter table public.ci_maquinaria_control_horas
  drop constraint if exists ci_maquinaria_horas_estado_liquidacion_check;

alter table public.ci_maquinaria_control_horas
  add constraint ci_maquinaria_horas_estado_liquidacion_check
  check (estado_liquidacion in ('pendiente', 'liquidado'));

create index if not exists idx_ci_maquinaria_horas_liq_pendiente
  on public.ci_maquinaria_control_horas (ci_proyecto_id, estado_liquidacion, fecha_trabajo desc);

alter table public.ci_maquinaria_liquidaciones enable row level security;

drop policy if exists "ci_maquinaria_liq_all_anon" on public.ci_maquinaria_liquidaciones;
create policy "ci_maquinaria_liq_all_anon" on public.ci_maquinaria_liquidaciones
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.ci_maquinaria_liquidaciones to anon, authenticated, service_role;

create or replace function public.ci_liquidar_maquinaria_intercompany(
  p_proyecto_id uuid,
  p_periodo_desde date,
  p_periodo_hasta date,
  p_tasa_bcv numeric,
  p_entidad_origen_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo record;
  v_liq_id uuid;
  v_lineas int := 0;
  v_total_usd numeric(18, 2) := 0;
  v_liquidaciones jsonb := '[]'::jsonb;
begin
  if p_tasa_bcv is null or p_tasa_bcv <= 0 then
    raise exception 'tasa_bcv_invalida';
  end if;
  if p_periodo_hasta < p_periodo_desde then
    raise exception 'periodo_invalido';
  end if;
  if p_entidad_origen_id is null then
    raise exception 'entidad_origen_requerida';
  end if;

  for v_grupo in
    select
      m.entidad_propietaria_id as entidad_destino_id,
      coalesce(sum(h.costo_transferencia_interna), 0)::numeric(18, 2) as monto_usd,
      array_agg(h.id order by h.fecha_trabajo) as hora_ids
    from public.ci_maquinaria_control_horas h
    inner join public.ci_maquinaria_maestro m on m.id = h.maquinaria_id
    where h.ci_proyecto_id = p_proyecto_id
      and h.estado_liquidacion = 'pendiente'
      and h.fecha_trabajo >= p_periodo_desde
      and h.fecha_trabajo <= p_periodo_hasta
    group by m.entidad_propietaria_id
  loop
    if v_grupo.entidad_destino_id is null then
      raise exception 'maquinaria_sin_entidad_propietaria';
    end if;
    if coalesce(v_grupo.monto_usd, 0) <= 0 then
      continue;
    end if;

    insert into public.ci_maquinaria_liquidaciones (
      proyecto_id,
      entidad_origen_id,
      entidad_destino_id,
      monto_total_usd,
      monto_total_ves,
      tasa_bcv_aplicada,
      periodo_desde,
      periodo_hasta
    )
    values (
      p_proyecto_id,
      p_entidad_origen_id,
      v_grupo.entidad_destino_id,
      v_grupo.monto_usd,
      round(v_grupo.monto_usd * p_tasa_bcv, 2),
      p_tasa_bcv,
      p_periodo_desde,
      p_periodo_hasta
    )
    returning id into v_liq_id;

    update public.ci_maquinaria_control_horas
    set
      estado_liquidacion = 'liquidado',
      liquidacion_id = v_liq_id
    where id = any (v_grupo.hora_ids);

    v_lineas := v_lineas + coalesce(array_length(v_grupo.hora_ids, 1), 0);
    v_total_usd := v_total_usd + v_grupo.monto_usd;

    v_liquidaciones := v_liquidaciones || jsonb_build_array(
      jsonb_build_object(
        'id', v_liq_id,
        'entidad_destino_id', v_grupo.entidad_destino_id,
        'monto_total_usd', v_grupo.monto_usd,
        'lineas', coalesce(array_length(v_grupo.hora_ids, 1), 0)
      )
    );
  end loop;

  if v_lineas = 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'No existen horas de maquinaria pendientes por liquidar en este ciclo.',
      'lineas_procesadas', 0
    );
  end if;

  update public.ci_proyecto_fondos
  set
    saldo_usd = saldo_usd - v_total_usd,
    updated_at = now()
  where proyecto_id = p_proyecto_id;

  return jsonb_build_object(
    'success', true,
    'liquidaciones', v_liquidaciones,
    'monto_liquidado_usd', v_total_usd,
    'lineas_procesadas', v_lineas
  );
end;
$$;

grant execute on function public.ci_liquidar_maquinaria_intercompany(uuid, date, date, numeric, uuid)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
