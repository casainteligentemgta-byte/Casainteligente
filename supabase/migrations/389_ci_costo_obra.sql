-- Centro de costo por obra: RPC `ci_costo_obra(proyecto_id)` con 4 partidas
-- (materiales, mano de obra, herramientas, otros) + honorarios AD aparte.
--
-- MATERIALES
--   Compras imputadas a la obra (`contabilidad_compras.proyecto_id`).
--   Las salidas de almacén cuyo origen ya pertenece a esta obra NO se suman
--   otra vez (el material ya se pagó en la compra).
--   Las salidas desde almacén central de otro proyecto o sin obra
--   (`inv_ubicaciones.ci_proyecto_id is distinct from la obra`) SÍ se suman
--   a costo promedio (`global_inventory.average_weighted_cost`, si no
--   `last_purchase_price`).
--
-- MANO DE OBRA
--   Nómina pagada (`ci_nomina_obra_periodos.estado = 'pagado'`) si existe
--   para el empleado y la semana. Si no hay nómina pagada que cubra esa
--   fecha, se usan jornales (`ci_jornales_obra_asistencias` presente).
--   NUNCA se suman nómina y jornales para el mismo empleado y periodo.
--
-- HERRAMIENTAS / EQUIPOS
--   Días de asignación × `costo_diario` × cantidad. Si no hay costo diario
--   y es arriendo, se usa `costo_arriendo` (total del periodo).
--
-- OTROS
--   `gastos_obra` + `registros_gastos` que no sean materiales / mano de obra
--   / honorarios (para no duplicar las otras partidas).
--
-- Honorarios AD: `cco_proyecto_config.honorarios_admin_pct` (0 es válido).
-- Si no hay fila de config, se usa 15. No se mezclan con las 4 partidas.
--
-- Obras DEMO (nombre ilike '%[DEMO]%' o 'DEMO-%'): total 0 y flag excluido.

-- ── Columnas de costeo en equipos asignados a obra ──────────────────────────
alter table public.ci_proyecto_equipos
  add column if not exists costo_diario numeric(14, 4),
  add column if not exists fecha_devolucion date;

alter table public.ci_proyecto_equipos
  drop constraint if exists ci_proyecto_equipos_costo_diario_nonneg;
alter table public.ci_proyecto_equipos
  add constraint ci_proyecto_equipos_costo_diario_nonneg
  check (costo_diario is null or costo_diario >= 0);

comment on column public.ci_proyecto_equipos.costo_diario is
  'Costo USD por día de uso en obra (herramienta/equipo propio o arriendo diario).';
comment on column public.ci_proyecto_equipos.fecha_devolucion is
  'Día en que se devolvió a almacén/catálogo. Null = sigue asignada.';
comment on column public.ci_proyecto_equipos.fecha_asignacion is
  'Fecha en que el equipo/herramienta quedó asignado a la obra.';

create index if not exists idx_ci_proyecto_equipos_obra_asignacion
  on public.ci_proyecto_equipos (proyecto_id, fecha_asignacion)
  where proyecto_id is not null;

-- ── Helpers inmutables ──────────────────────────────────────────────────────
create or replace function public.ci_obra_es_demo(p_nombre text)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(p_nombre, '') ilike '%[DEMO]%'
      or coalesce(p_nombre, '') ilike 'DEMO-%';
$$;

comment on function public.ci_obra_es_demo(text) is
  'True si el nombre de la obra es semilla DEMO y no debe entrar en reportes de costo.';

create or replace function public.ci_costo_obra_monto_fuente_usd(
  p_monto_usd numeric,
  p_monto_ves numeric,
  p_total_amount numeric,
  p_moneda text,
  p_tasa_almacenada numeric,
  p_tasa_fallback numeric
)
returns numeric
language plpgsql
immutable
parallel safe
as $$
declare
  v_usd numeric;
  v_tasa numeric;
  v_ves numeric;
  v_mon text;
begin
  v_usd := coalesce(p_monto_usd, 0);
  if v_usd > 0 then
    return round(v_usd, 2);
  end if;
  v_tasa := coalesce(nullif(p_tasa_almacenada, 0), nullif(p_tasa_fallback, 0), 0);
  v_mon := upper(trim(coalesce(p_moneda, '')));
  if v_mon = 'USD' then
    v_usd := coalesce(nullif(p_total_amount, 0), nullif(p_monto_ves, 0), 0);
    if v_usd > 0 then
      return round(v_usd, 2);
    end if;
    return 0;
  end if;
  v_ves := coalesce(nullif(p_monto_ves, 0), nullif(p_total_amount, 0), 0);
  if v_ves <= 0 or v_tasa <= 0 then
    return 0;
  end if;
  return round(v_ves / v_tasa, 2);
end;
$$;

-- ── RPC principal ───────────────────────────────────────────────────────────
create or replace function public.ci_costo_obra(p_proyecto_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_nombre text;
  v_tasa numeric := 36.5;
  v_mat_compras numeric := 0;
  v_mat_egresos numeric := 0;
  v_mo_nomina numeric := 0;
  v_mo_jornales numeric := 0;
  v_herr numeric := 0;
  v_otros_gastos numeric := 0;
  v_otros_registros numeric := 0;
  v_pct numeric := 15;
  v_fuente_ad text := 'default';
  v_honorarios numeric := 0;
  v_directo numeric := 0;
  v_fuente_mo text := 'ninguna';
  v_det_mat jsonb := '[]'::jsonb;
  v_det_mo jsonb := '[]'::jsonb;
  v_det_herr jsonb := '[]'::jsonb;
  v_det_otros jsonb := '[]'::jsonb;
  v_vacio jsonb;
begin
  if p_proyecto_id is null then
    raise exception 'proyecto_id requerido';
  end if;

  select p.nombre into v_nombre
  from public.ci_proyectos p
  where p.id = p_proyecto_id;

  if v_nombre is null then
    raise exception 'Proyecto no encontrado';
  end if;

  v_vacio := jsonb_build_object(
    'proyecto_id', p_proyecto_id,
    'proyecto_nombre', v_nombre,
    'excluido_demo', true,
    'regla_mano_obra',
      'Nómina pagada si existe para el empleado y la semana; si no, jornales. Nunca ambos para el mismo empleado y periodo.',
    'tasa_bcv_ves_por_usd', 0,
    'partidas', jsonb_build_object(
      'materiales', jsonb_build_object('usd', 0, 'compras_usd', 0, 'egresos_ajenos_usd', 0, 'detalle', '[]'::jsonb),
      'mano_obra', jsonb_build_object('usd', 0, 'fuente', 'ninguna', 'nomina_usd', 0, 'jornales_usd', 0, 'detalle', '[]'::jsonb),
      'herramientas', jsonb_build_object('usd', 0, 'detalle', '[]'::jsonb),
      'otros', jsonb_build_object('usd', 0, 'gastos_obra_usd', 0, 'registros_gastos_usd', 0, 'detalle', '[]'::jsonb)
    ),
    'honorarios_ad', jsonb_build_object('pct', 0, 'usd', 0, 'fuente', 'excluido_demo'),
    'total_directo_usd', 0,
    'total_con_honorarios_ad_usd', 0
  );

  if public.ci_obra_es_demo(v_nombre) then
    return v_vacio;
  end if;

  begin
    select c.tasa_bcv_ves_por_usd into v_tasa
    from public.ci_config_nomina c
    where upper(trim(c.cargo_codigo)) = 'GLOBAL'
      and coalesce(c.tasa_bcv_ves_por_usd, 0) > 0
    limit 1;
  exception when undefined_table or undefined_column then
    v_tasa := 36.5;
  end;
  if v_tasa is null or v_tasa <= 0 then
    v_tasa := 36.5;
  end if;

  -- ── MATERIALES: compras imputadas ─────────────────────────────────────────
  begin
    select
      coalesce(sum(public.ci_costo_obra_monto_fuente_usd(
        c.monto_usd, c.monto_ves, c.total_amount,
        coalesce(c.moneda_original, c.moneda),
        c.tasa_bcv_ves_por_usd, v_tasa
      )), 0),
      coalesce(jsonb_agg(sub.item order by sub.usd desc) filter (where sub.item is not null), '[]'::jsonb)
    into v_mat_compras, v_det_mat
    from public.contabilidad_compras c
    left join lateral (
      select jsonb_build_object(
        'tipo', 'compra',
        'id', c.id,
        'label', coalesce(nullif(trim(c.supplier_name), ''), nullif(trim(c.invoice_number), ''), 'Compra'),
        'usd', public.ci_costo_obra_monto_fuente_usd(
          c.monto_usd, c.monto_ves, c.total_amount,
          coalesce(c.moneda_original, c.moneda),
          c.tasa_bcv_ves_por_usd, v_tasa
        )
      ) as item,
      public.ci_costo_obra_monto_fuente_usd(
        c.monto_usd, c.monto_ves, c.total_amount,
        coalesce(c.moneda_original, c.moneda),
        c.tasa_bcv_ves_por_usd, v_tasa
      ) as usd
    ) sub on true
    where c.proyecto_id = p_proyecto_id
      and coalesce(upper(trim(c.tipo_gasto_cco)), 'MATERIALES')
        not in ('MANO DE OBRA', 'HONORARIOS', 'ADMIN');
  exception when undefined_table or undefined_column then
    begin
      select coalesce(sum(public.ci_costo_obra_monto_fuente_usd(
        c.monto_usd, c.monto_ves, c.total_amount,
        coalesce(c.moneda_original, c.moneda),
        c.tasa_bcv_ves_por_usd, v_tasa
      )), 0)
      into v_mat_compras
      from public.contabilidad_compras c
      where c.proyecto_id = p_proyecto_id;
    exception when undefined_table or undefined_column then
      v_mat_compras := 0;
    end;
    v_det_mat := '[]'::jsonb;
  end;

  -- ── MATERIALES: egresos desde almacén ajeno (no doble conteo) ─────────────
  begin
    select
      coalesce(sum(round(
        coalesce(l.cantidad, 0)
        * coalesce(nullif(gi.average_weighted_cost, 0), nullif(gi.last_purchase_price, 0), 0)
      , 2)), 0),
      coalesce(
        jsonb_agg(jsonb_build_object(
          'tipo', 'egreso_ajeno',
          'id', l.id,
          'label', coalesce(nullif(trim(l.material_nombre), ''), 'Material')
            || ' · ' || coalesce(nullif(trim(u.nombre), ''), 'almacén ajeno'),
          'usd', round(
            coalesce(l.cantidad, 0)
            * coalesce(nullif(gi.average_weighted_cost, 0), nullif(gi.last_purchase_price, 0), 0)
          , 2)
        )) filter (where l.id is not null),
        '[]'::jsonb
      )
    into v_mat_egresos, v_det_mat
    from public.inv_egresos_campo e
    join public.inv_egresos_campo_lineas l on l.egreso_id = e.id
    join public.inv_ubicaciones u on u.id = e.origen_ubicacion_id
    left join public.global_inventory gi on gi.id = l.material_id
    where e.proyecto_id = p_proyecto_id
      and u.ci_proyecto_id is distinct from p_proyecto_id;

    -- Concatenar detalle de compras (ya calculado) + egresos ajenos.
    -- v_det_mat ahora es solo egresos; lo unimos más abajo.
  exception when undefined_table or undefined_column then
    v_mat_egresos := 0;
  end;

  -- Rehacer detalle de compras (el select de egresos sobrescribió v_det_mat).
  begin
    select coalesce(jsonb_agg(x.item order by (x.item->>'usd')::numeric desc), '[]'::jsonb)
    into v_det_mat
    from (
      select jsonb_build_object(
        'tipo', 'compra',
        'id', c.id,
        'label', coalesce(nullif(trim(c.supplier_name), ''), nullif(trim(c.invoice_number), ''), 'Compra'),
        'usd', public.ci_costo_obra_monto_fuente_usd(
          c.monto_usd, c.monto_ves, c.total_amount,
          coalesce(c.moneda_original, c.moneda),
          c.tasa_bcv_ves_por_usd, v_tasa
        )
      ) as item
      from public.contabilidad_compras c
      where c.proyecto_id = p_proyecto_id
        and coalesce(upper(trim(c.tipo_gasto_cco)), 'MATERIALES')
          not in ('MANO DE OBRA', 'HONORARIOS', 'ADMIN')
      union all
      select jsonb_build_object(
        'tipo', 'egreso_ajeno',
        'id', l.id,
        'label', coalesce(nullif(trim(l.material_nombre), ''), 'Material')
          || ' · ' || coalesce(nullif(trim(u.nombre), ''), 'almacén ajeno'),
        'usd', round(
          coalesce(l.cantidad, 0)
          * coalesce(nullif(gi.average_weighted_cost, 0), nullif(gi.last_purchase_price, 0), 0)
        , 2)
      )
      from public.inv_egresos_campo e
      join public.inv_egresos_campo_lineas l on l.egreso_id = e.id
      join public.inv_ubicaciones u on u.id = e.origen_ubicacion_id
      left join public.global_inventory gi on gi.id = l.material_id
      where e.proyecto_id = p_proyecto_id
        and u.ci_proyecto_id is distinct from p_proyecto_id
    ) x;
  exception when undefined_table or undefined_column then
    v_det_mat := coalesce(v_det_mat, '[]'::jsonb);
  end;

  -- ── MANO DE OBRA ──────────────────────────────────────────────────────────
  -- Nómina pagada.
  begin
    select
      coalesce(sum(i.total_usd), 0),
      coalesce(jsonb_agg(jsonb_build_object(
        'tipo', 'nomina',
        'id', i.id,
        'label', coalesce(nullif(trim(em.nombre_completo), ''), 'Obrero')
          || ' · semana ' || to_char(p.semana_inicio, 'DD/MM')
          || '–' || to_char(p.semana_fin, 'DD/MM'),
        'usd', round(coalesce(i.total_usd, 0), 2),
        'empleado_id', i.empleado_id,
        'desde', p.semana_inicio,
        'hasta', p.semana_fin
      )), '[]'::jsonb)
    into v_mo_nomina, v_det_mo
    from public.ci_nomina_obra_items i
    join public.ci_nomina_obra_periodos p on p.id = i.periodo_id
    left join public.ci_empleados em on em.id = i.empleado_id
    where p.proyecto_id = p_proyecto_id
      and p.estado = 'pagado';
  exception when undefined_table or undefined_column then
    v_mo_nomina := 0;
    v_det_mo := '[]'::jsonb;
  end;

  -- Jornales no cubiertos por nómina pagada del mismo empleado+semana.
  begin
    if to_regclass('public.ci_nomina_obra_periodos') is not null
       and to_regclass('public.ci_nomina_obra_items') is not null then
      select
        coalesce(sum(a.costo_jornal), 0),
        coalesce(v_det_mo, '[]'::jsonb) || coalesce(jsonb_agg(jsonb_build_object(
          'tipo', 'jornal',
          'id', a.id,
          'label', coalesce(nullif(trim(em.nombre_completo), ''), 'Obrero')
            || ' · ' || to_char(a.fecha, 'DD/MM/YYYY'),
          'usd', round(coalesce(a.costo_jornal, 0), 2),
          'empleado_id', a.empleado_id,
          'fecha', a.fecha
        )), '[]'::jsonb)
      into v_mo_jornales, v_det_mo
      from public.ci_jornales_obra_asistencias a
      left join public.ci_empleados em on em.id = a.empleado_id
      where a.proyecto_id = p_proyecto_id
        and a.estado = 'presente'
        and not exists (
          select 1
          from public.ci_nomina_obra_items i
          join public.ci_nomina_obra_periodos p on p.id = i.periodo_id
          where p.proyecto_id = p_proyecto_id
            and p.estado = 'pagado'
            and i.empleado_id = a.empleado_id
            and a.fecha between p.semana_inicio and p.semana_fin
        );
    else
      select
        coalesce(sum(a.costo_jornal), 0),
        coalesce(v_det_mo, '[]'::jsonb) || coalesce(jsonb_agg(jsonb_build_object(
          'tipo', 'jornal',
          'id', a.id,
          'label', coalesce(nullif(trim(em.nombre_completo), ''), 'Obrero')
            || ' · ' || to_char(a.fecha, 'DD/MM/YYYY'),
          'usd', round(coalesce(a.costo_jornal, 0), 2),
          'empleado_id', a.empleado_id,
          'fecha', a.fecha
        )), '[]'::jsonb)
      into v_mo_jornales, v_det_mo
      from public.ci_jornales_obra_asistencias a
      left join public.ci_empleados em on em.id = a.empleado_id
      where a.proyecto_id = p_proyecto_id
        and a.estado = 'presente';
    end if;
  exception when undefined_table or undefined_column then
    v_mo_jornales := 0;
  end;

  if v_mo_nomina > 0 and v_mo_jornales > 0 then
    v_fuente_mo := 'mixto';
  elsif v_mo_nomina > 0 then
    v_fuente_mo := 'nomina';
  elsif v_mo_jornales > 0 then
    v_fuente_mo := 'jornales';
  else
    v_fuente_mo := 'ninguna';
  end if;

  -- ── HERRAMIENTAS / EQUIPOS ────────────────────────────────────────────────
  begin
    select
      coalesce(sum(x.usd), 0),
      coalesce(jsonb_agg(jsonb_build_object(
        'tipo', 'equipo',
        'id', x.id,
        'label', x.nombre,
        'usd', x.usd,
        'dias', x.dias,
        'costo_diario', x.costo_diario_usado
      ) order by x.usd desc), '[]'::jsonb)
    into v_herr, v_det_herr
    from (
      select
        e.id,
        coalesce(nullif(trim(e.nombre_equipo), ''), 'Equipo') as nombre,
        v_dias.n as dias,
        v_costo.diario as costo_diario_usado,
        round(v_costo.usd, 2) as usd
      from public.ci_proyecto_equipos e
      cross join lateral (
        select greatest(
          1,
          (
            coalesce(e.fecha_devolucion, least(coalesce(e.fecha_arriendo_fin, current_date), current_date))
            - coalesce(e.fecha_asignacion, e.fecha_arriendo_inicio, e.created_at::date, current_date)
          ) + 1
        ) as n
      ) v_dias
      cross join lateral (
        select
          case
            when coalesce(e.costo_diario, 0) > 0 then e.costo_diario
            else 0
          end as diario,
          case
            when coalesce(e.costo_diario, 0) > 0 then
              e.costo_diario * v_dias.n * coalesce(nullif(e.cantidad, 0), 1)
            when coalesce(e.costo_arriendo, 0) > 0
              and upper(trim(coalesce(e.moneda_arriendo, 'USD'))) = 'USD' then
              e.costo_arriendo
            when coalesce(e.costo_arriendo, 0) > 0 and v_tasa > 0 then
              e.costo_arriendo / v_tasa
            else 0
          end as usd
      ) v_costo
      where e.proyecto_id = p_proyecto_id
    ) x;
  exception when undefined_table or undefined_column then
    v_herr := 0;
    v_det_herr := '[]'::jsonb;
  end;

  -- ── OTROS: gastos_obra ────────────────────────────────────────────────────
  begin
    select
      coalesce(sum(coalesce(g.costo, 0)), 0),
      coalesce(jsonb_agg(jsonb_build_object(
        'tipo', 'gasto_obra',
        'id', g.id,
        'label', coalesce(nullif(trim(g.descripcion), ''), nullif(trim(g.tipo), ''), 'Gasto'),
        'usd', round(coalesce(g.costo, 0), 2)
      )), '[]'::jsonb)
    into v_otros_gastos, v_det_otros
    from public.gastos_obra g
    where g.proyecto_id = p_proyecto_id;
  exception when undefined_table or undefined_column then
    v_otros_gastos := 0;
    v_det_otros := '[]'::jsonb;
  end;

  -- ── OTROS: registros_gastos (no materiales / MO / honorarios) ─────────────
  begin
    select
      coalesce(sum(coalesce(r.monto_base_usd, 0)), 0),
      coalesce(v_det_otros, '[]'::jsonb) || coalesce(jsonb_agg(jsonb_build_object(
        'tipo', 'registro_gasto',
        'id', r.id,
        'label', coalesce(nullif(trim(r.descripcion), ''), nullif(trim(r.proveedor), ''), coalesce(r.tipo, 'Gasto')),
        'usd', round(coalesce(r.monto_base_usd, 0), 2)
      )), '[]'::jsonb)
    into v_otros_registros, v_det_otros
    from public.registros_gastos r
    where r.proyecto_id = p_proyecto_id
      and coalesce(upper(trim(r.tipo)), '') not in ('MATERIALES', 'MANO DE OBRA', 'HONORARIOS', 'ADMIN')
      and coalesce(upper(trim(r.clase)), '') not in ('MATERIALES', 'MANO DE OBRA', 'HONORARIOS', 'ADMIN');
  exception when undefined_table or undefined_column then
    v_otros_registros := 0;
  end;

  -- Recortar detalle a 40 filas por partida (pantalla móvil).
  v_det_mat := coalesce((
    select jsonb_agg(elem) from (
      select elem from jsonb_array_elements(coalesce(v_det_mat, '[]'::jsonb)) elem
      order by coalesce((elem->>'usd')::numeric, 0) desc
      limit 40
    ) s
  ), '[]'::jsonb);
  v_det_mo := coalesce((
    select jsonb_agg(elem) from (
      select elem from jsonb_array_elements(coalesce(v_det_mo, '[]'::jsonb)) elem
      order by coalesce((elem->>'usd')::numeric, 0) desc
      limit 40
    ) s
  ), '[]'::jsonb);
  v_det_herr := coalesce((
    select jsonb_agg(elem) from (
      select elem from jsonb_array_elements(coalesce(v_det_herr, '[]'::jsonb)) elem
      order by coalesce((elem->>'usd')::numeric, 0) desc
      limit 40
    ) s
  ), '[]'::jsonb);
  v_det_otros := coalesce((
    select jsonb_agg(elem) from (
      select elem from jsonb_array_elements(coalesce(v_det_otros, '[]'::jsonb)) elem
      order by coalesce((elem->>'usd')::numeric, 0) desc
      limit 40
    ) s
  ), '[]'::jsonb);

  v_mat_compras := round(coalesce(v_mat_compras, 0), 2);
  v_mat_egresos := round(coalesce(v_mat_egresos, 0), 2);
  v_mo_nomina := round(coalesce(v_mo_nomina, 0), 2);
  v_mo_jornales := round(coalesce(v_mo_jornales, 0), 2);
  v_herr := round(coalesce(v_herr, 0), 2);
  v_otros_gastos := round(coalesce(v_otros_gastos, 0), 2);
  v_otros_registros := round(coalesce(v_otros_registros, 0), 2);

  v_directo := round(
    v_mat_compras + v_mat_egresos + v_mo_nomina + v_mo_jornales + v_herr
    + v_otros_gastos + v_otros_registros
  , 2);

  -- Honorarios AD: 0 es válido. Solo default 15 si no hay fila de config.
  begin
    select c.honorarios_admin_pct into v_pct
    from public.cco_proyecto_config c
    where c.proyecto_id = p_proyecto_id;
    if found then
      v_fuente_ad := 'cco_proyecto_config';
      if v_pct is null or v_pct < 0 then
        v_pct := 15;
        v_fuente_ad := 'default';
      end if;
    else
      v_pct := 15;
      v_fuente_ad := 'default';
    end if;
  exception when undefined_table or undefined_column then
    v_pct := 15;
    v_fuente_ad := 'default';
  end;

  if v_pct > 0 and v_directo > 0 then
    v_honorarios := round(v_directo * (v_pct / 100.0), 2);
  else
    v_honorarios := 0;
  end if;

  return jsonb_build_object(
    'proyecto_id', p_proyecto_id,
    'proyecto_nombre', v_nombre,
    'excluido_demo', false,
    'regla_mano_obra',
      'Nómina pagada si existe para el empleado y la semana; si no, jornales. Nunca ambos para el mismo empleado y periodo.',
    'tasa_bcv_ves_por_usd', v_tasa,
    'partidas', jsonb_build_object(
      'materiales', jsonb_build_object(
        'usd', round(v_mat_compras + v_mat_egresos, 2),
        'compras_usd', v_mat_compras,
        'egresos_ajenos_usd', v_mat_egresos,
        'detalle', v_det_mat
      ),
      'mano_obra', jsonb_build_object(
        'usd', round(v_mo_nomina + v_mo_jornales, 2),
        'fuente', v_fuente_mo,
        'nomina_usd', v_mo_nomina,
        'jornales_usd', v_mo_jornales,
        'detalle', v_det_mo
      ),
      'herramientas', jsonb_build_object(
        'usd', v_herr,
        'detalle', v_det_herr
      ),
      'otros', jsonb_build_object(
        'usd', round(v_otros_gastos + v_otros_registros, 2),
        'gastos_obra_usd', v_otros_gastos,
        'registros_gastos_usd', v_otros_registros,
        'detalle', v_det_otros
      )
    ),
    'honorarios_ad', jsonb_build_object(
      'pct', v_pct,
      'usd', v_honorarios,
      'fuente', v_fuente_ad
    ),
    'total_directo_usd', v_directo,
    'total_con_honorarios_ad_usd', round(v_directo + v_honorarios, 2)
  );
end;
$$;

comment on function public.ci_costo_obra(uuid) is
  'Centro de costo por obra (USD): materiales (sin doble conteo almacén), mano de obra (nómina pagada o jornales, nunca ambos), herramientas por día, otros. Honorarios AD aparte (0 válido). Excluye DEMO.';

-- Vista de conveniencia (una fila JSON por obra no-DEMO). Preferir el RPC
-- con proyecto_id concreto: select public.ci_costo_obra('<uuid>').
create or replace view public.ci_v_costo_obra
with (security_invoker = true) as
select
  p.id as proyecto_id,
  p.nombre as proyecto_nombre,
  public.ci_costo_obra(p.id) as costo
from public.ci_proyectos p
where not public.ci_obra_es_demo(p.nombre);

comment on view public.ci_v_costo_obra is
  'Costo por obra no-DEMO. Cada fila llama a ci_costo_obra(id); para una obra use el RPC.';

revoke all on function public.ci_obra_es_demo(text) from public, anon;
grant execute on function public.ci_obra_es_demo(text) to authenticated, service_role;

revoke all on function public.ci_costo_obra_monto_fuente_usd(numeric, numeric, numeric, text, numeric, numeric) from public, anon;
grant execute on function public.ci_costo_obra_monto_fuente_usd(numeric, numeric, numeric, text, numeric, numeric) to authenticated, service_role;

revoke all on function public.ci_costo_obra(uuid) from public, anon;
grant execute on function public.ci_costo_obra(uuid) to authenticated, service_role;

grant select on public.ci_v_costo_obra to authenticated, service_role;
revoke all on public.ci_v_costo_obra from anon, public;

notify pgrst, 'reload schema';
