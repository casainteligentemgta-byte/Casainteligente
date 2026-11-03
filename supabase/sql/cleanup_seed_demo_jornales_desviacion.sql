-- Limpieza MANUAL de datos demo (seed_tag = demo_jornales_desviacion_v1).
-- No forma parte de la cadena automática de migraciones: hay que ejecutarla
-- en el SQL Editor cuando se quieran borrar las obras / jornales / compras de demostración.
--
-- Idempotente. No toca filas de producción sin el marcador.
-- En producción ci_obra_empleados.obra_id referencia ci_obras, no ci_proyectos:
-- no borrar cuadrilla usando UUID de proyecto demo como obra_id.

do $$
declare
  v_tag text := 'demo_jornales_desviacion_v1';
  v_ids uuid[] := array[
    'a1111111-b222-4c33-8d44-000000000001'::uuid,
    'a1111111-b222-4c33-8d44-000000000002'::uuid,
    'a1111111-b222-4c33-8d44-000000000101'::uuid,
    'a1111111-b222-4c33-8d44-000000000102'::uuid,
    'a1111111-b222-4c33-8d44-000000000103'::uuid,
    'a1111111-b222-4c33-8d44-000000000201'::uuid,
    'a1111111-b222-4c33-8d44-000000000202'::uuid,
    'a1111111-b222-4c33-8d44-000000000203'::uuid,
    'a1111111-b222-4c33-8d44-000000000211'::uuid,
    'a1111111-b222-4c33-8d44-000000000212'::uuid,
    'a1111111-b222-4c33-8d44-000000000221'::uuid,
    'a1111111-b222-4c33-8d44-000000000222'::uuid,
    'a1111111-b222-4c33-8d44-000000000223'::uuid,
    'a1111111-b222-4c33-8d44-000000000301'::uuid,
    'a1111111-b222-4c33-8d44-000000000302'::uuid,
    'a1111111-b222-4c33-8d44-000000000303'::uuid,
    'a1111111-b222-4c33-8d44-000000000401'::uuid,
    'a1111111-b222-4c33-8d44-000000000411'::uuid,
    'a1111111-b222-4c33-8d44-000000000412'::uuid,
    'a1111111-b222-4c33-8d44-000000000413'::uuid,
    'a1111111-b222-4c33-8d44-000000000501'::uuid,
    'a1111111-b222-4c33-8d44-000000000502'::uuid,
    'a1111111-b222-4c33-8d44-000000000503'::uuid,
    'a1111111-b222-4c33-8d44-000000000504'::uuid,
    'a1111111-b222-4c33-8d44-000000000505'::uuid,
    'a1111111-b222-4c33-8d44-000000000506'::uuid,
    'a1111111-b222-4c33-8d44-000000000507'::uuid,
    'a1111111-b222-4c33-8d44-000000000508'::uuid,
    'a1111111-b222-4c33-8d44-000000000509'::uuid,
    'a1111111-b222-4c33-8d44-000000000601'::uuid,
    'a1111111-b222-4c33-8d44-000000000602'::uuid,
    'a1111111-b222-4c33-8d44-000000000603'::uuid,
    'a1111111-b222-4c33-8d44-000000000701'::uuid,
    'a1111111-b222-4c33-8d44-000000000702'::uuid,
    'a1111111-b222-4c33-8d44-000000000703'::uuid
  ];
  v_proyectos uuid[] := array[
    'a1111111-b222-4c33-8d44-000000000101'::uuid,
    'a1111111-b222-4c33-8d44-000000000102'::uuid,
    'a1111111-b222-4c33-8d44-000000000103'::uuid
  ];
  v_empleados uuid[] := array[
    'a1111111-b222-4c33-8d44-000000000201'::uuid,
    'a1111111-b222-4c33-8d44-000000000202'::uuid,
    'a1111111-b222-4c33-8d44-000000000203'::uuid,
    'a1111111-b222-4c33-8d44-000000000211'::uuid,
    'a1111111-b222-4c33-8d44-000000000212'::uuid,
    'a1111111-b222-4c33-8d44-000000000221'::uuid,
    'a1111111-b222-4c33-8d44-000000000222'::uuid,
    'a1111111-b222-4c33-8d44-000000000223'::uuid
  ];
  v_egresos uuid[];
  v_compras uuid[];
begin
  if to_regclass('public.ci_jornales_obra_asistencias') is not null then
    delete from public.ci_jornales_obra_asistencias
    where seed_tag = v_tag or proyecto_id = any (v_proyectos);
    delete from public.ci_jornales_obra_tarifas
    where seed_tag = v_tag or proyecto_id = any (v_proyectos);
    delete from public.ci_proyecto_desviacion_config
    where seed_tag = v_tag or proyecto_id = any (v_proyectos);
  end if;

  if to_regclass('public.inv_egresos_campo') is not null then
    select coalesce(array_agg(id), array[]::uuid[]) into v_egresos
    from public.inv_egresos_campo
    where id = any (v_ids) or observaciones = v_tag or proyecto_id = any (v_proyectos);
    if to_regclass('public.inv_egresos_campo_lineas') is not null then
      delete from public.inv_egresos_campo_lineas where egreso_id = any (v_egresos);
    end if;
    delete from public.inv_egresos_campo where id = any (v_egresos);
  end if;

  if to_regclass('public.contabilidad_compras') is not null then
    select coalesce(array_agg(id), array[]::uuid[]) into v_compras
    from public.contabilidad_compras
    where id = any (v_ids) or notas = v_tag or origen = 'seed_demo' or proyecto_id = any (v_proyectos);
    if to_regclass('public.contabilidad_compra_lineas') is not null then
      delete from public.contabilidad_compra_lineas where compra_id = any (v_compras);
    end if;
    delete from public.contabilidad_compras where id = any (v_compras);
  end if;

  if to_regclass('public.ci_presupuesto_partidas') is not null then
    delete from public.ci_presupuesto_partidas
    where id = any (v_ids) or origen = 'seed_demo' or proyecto_id = any (v_proyectos);
  end if;

  -- En producción ci_obra_empleados.obra_id referencia ci_obras, no ci_proyectos.
  -- El seed 383 no inserta cuadrilla; no borrar por obra_id = UUID de proyecto demo.
  if to_regclass('public.ci_obra_empleados') is not null then
    delete from public.ci_obra_empleados
    where empleado_id = any (v_empleados);
  end if;

  if to_regclass('public.inventario_stock') is not null then
    delete from public.inventario_stock
    where ubicacion_id in (
      'a1111111-b222-4c33-8d44-000000000401'::uuid,
      'a1111111-b222-4c33-8d44-000000000411'::uuid,
      'a1111111-b222-4c33-8d44-000000000412'::uuid,
      'a1111111-b222-4c33-8d44-000000000413'::uuid
    );
  end if;

  if to_regclass('public.inv_ubicaciones') is not null then
    delete from public.inv_ubicaciones where id = any (v_ids) or notas = v_tag;
  end if;

  if to_regclass('public.global_inventory') is not null then
    delete from public.global_inventory where id = any (v_ids) or sap_code like 'DEMO-%';
  end if;

  if to_regclass('public.ci_empleados') is not null then
    delete from public.ci_empleados where id = any (v_empleados);
  end if;

  if to_regclass('public.ci_proyectos') is not null then
    delete from public.ci_proyectos where id = any (v_proyectos) or observaciones = v_tag;
  end if;

  if to_regclass('public.customers') is not null then
    delete from public.customers where id = 'a1111111-b222-4c33-8d44-000000000002';
  end if;

  if to_regclass('public.ci_entidades') is not null then
    delete from public.ci_entidades where id = 'a1111111-b222-4c33-8d44-000000000001';
  end if;

  if to_regclass('public.ci_seed_demo_filas') is not null then
    delete from public.ci_seed_demo_filas where seed_tag = v_tag;
  end if;
end $$;
