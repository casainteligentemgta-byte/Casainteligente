-- Datos de demostración para Control de jornales + alerta de desviación.
-- Independiente del schema 382 (falla si 382 no está aplicada).
-- Marcador: seed_tag = 'demo_jornales_desviacion_v1' y tabla ci_seed_demo_filas.
-- Limpieza manual: supabase/sql/cleanup_seed_demo_jornales_desviacion.sql
-- No aplicar a producción desde este agente; el dueño lo ejecuta cuando quiera demo.

-- Variante aplicada en producción (nov 2026): ci_proyectos.nombre_proyecto NOT NULL;
-- ci_empleados sin columnas oficio/status; sin insert en ci_obra_empleados
-- (en prod obra_id referencia ci_obras, no ci_proyectos).

-- Tres obras técnicas con semáforo verde / ámbar / rojo:
--   Verde  (~67%): Instalación CCTV Los Palos Grandes
--   Ámbar  (~92%): Automatización de red Chacao
--   Rojo   (~114%): CCTV Centro Empresarial (materiales + jornadas CCTV)

do $$
declare
  v_tag text := 'demo_jornales_desviacion_v1';
  v_entidad uuid := 'a1111111-b222-4c33-8d44-000000000001';
  v_customer uuid := 'a1111111-b222-4c33-8d44-000000000002';
  v_p_verde uuid := 'a1111111-b222-4c33-8d44-000000000101';
  v_p_ambar uuid := 'a1111111-b222-4c33-8d44-000000000102';
  v_p_rojo uuid := 'a1111111-b222-4c33-8d44-000000000103';
  v_e_ana uuid := 'a1111111-b222-4c33-8d44-000000000201';
  v_e_luis uuid := 'a1111111-b222-4c33-8d44-000000000202';
  v_e_carla uuid := 'a1111111-b222-4c33-8d44-000000000203';
  v_e_pedro uuid := 'a1111111-b222-4c33-8d44-000000000211';
  v_e_sofia uuid := 'a1111111-b222-4c33-8d44-000000000212';
  v_e_miguel uuid := 'a1111111-b222-4c33-8d44-000000000221';
  v_e_elena uuid := 'a1111111-b222-4c33-8d44-000000000222';
  v_e_jorge uuid := 'a1111111-b222-4c33-8d44-000000000223';
  v_mat_cam uuid := 'a1111111-b222-4c33-8d44-000000000301';
  v_mat_sw uuid := 'a1111111-b222-4c33-8d44-000000000302';
  v_mat_cab uuid := 'a1111111-b222-4c33-8d44-000000000303';
  v_ubi_alm uuid := 'a1111111-b222-4c33-8d44-000000000401';
  v_ubi_verde uuid := 'a1111111-b222-4c33-8d44-000000000411';
  v_ubi_ambar uuid := 'a1111111-b222-4c33-8d44-000000000412';
  v_ubi_rojo uuid := 'a1111111-b222-4c33-8d44-000000000413';
  v_c_verde uuid := 'a1111111-b222-4c33-8d44-000000000601';
  v_c_ambar uuid := 'a1111111-b222-4c33-8d44-000000000602';
  v_c_rojo uuid := 'a1111111-b222-4c33-8d44-000000000603';
  v_eg_verde uuid := 'a1111111-b222-4c33-8d44-000000000701';
  v_eg_ambar uuid := 'a1111111-b222-4c33-8d44-000000000702';
  v_eg_rojo uuid := 'a1111111-b222-4c33-8d44-000000000703';
begin
  if to_regclass('public.ci_jornales_obra_asistencias') is null then
    raise exception 'Falta migración 382_ci_jornales_obra_y_desviacion.sql';
  end if;

  insert into public.ci_entidades (id, nombre, rif, notas)
  values (
    v_entidad,
    '[DEMO] Casa Inteligente Tech',
    'J-00000000-0',
    v_tag
  )
  on conflict (id) do update set nombre = excluded.nombre, notas = excluded.notas;

  insert into public.customers (id, nombre, rif, tipo, status, direccion)
  values (
    v_customer,
    '[DEMO] Cliente Tech Venezuela',
    'J-00000001-1',
    'empresa',
    'activo',
    'Caracas, Venezuela (demo)'
  )
  on conflict (id) do update set nombre = excluded.nombre;

  insert into public.ci_proyectos (
    id, customer_id, nombre, nombre_proyecto, estado, ubicacion_texto, monto_aproximado, moneda,
    entidad_id, observaciones, tipo_proyecto
  )
  values
    (
      v_p_verde, v_customer,
      '[DEMO] Instalación CCTV Los Palos Grandes', '[DEMO] Instalación CCTV Los Palos Grandes',
      'ejecucion', 'Los Palos Grandes, Chacao, Caracas',
      20000, 'USD', v_entidad, v_tag, 'integral'
    ),
    (
      v_p_ambar, v_customer,
      '[DEMO] Automatización de red Chacao', '[DEMO] Automatización de red Chacao',
      'ejecucion', 'Chacao, Caracas',
      15000, 'USD', v_entidad, v_tag, 'integral'
    ),
    (
      v_p_rojo, v_customer,
      '[DEMO] CCTV Centro Empresarial', '[DEMO] CCTV Centro Empresarial',
      'ejecucion', 'El Rosal, Caracas',
      10000, 'USD', v_entidad, v_tag, 'integral'
    )
  on conflict (id) do update
    set nombre = excluded.nombre,
        observaciones = excluded.observaciones,
        entidad_id = excluded.entidad_id,
        monto_aproximado = excluded.monto_aproximado;

  insert into public.ci_empleados (
    id, nombre_completo, nombres, primer_apellido, documento, cedula,
    rol_examen, estado, estado_proceso, cargo_nombre, cargo_codigo,
    entidad_id, proyecto_modulo_id, email
  )
  values
    (v_e_ana, 'Ana Rivas', 'Ana', 'Rivas', 'V-20111222', 'V-20111222',
     'tecnico', 'aprobado', 'cv_completado', 'Instalador CCTV', 'INST_CCTV',
     v_entidad, v_p_verde, 'ana.rivas.demo@example.invalid'),
    (v_e_luis, 'Luis Mora', 'Luis', 'Mora', 'V-19888777', 'V-19888777',
     'tecnico', 'aprobado', 'cv_completado', 'Eléctrico', 'ELECT',
     v_entidad, v_p_verde, 'luis.mora.demo@example.invalid'),
    (v_e_carla, 'Carla Díaz', 'Carla', 'Díaz', 'V-21111000', 'V-21111000',
     'tecnico', 'aprobado', 'cv_completado', 'Ayudante', 'AYUD',
     v_entidad, v_p_verde, 'carla.diaz.demo@example.invalid'),
    (v_e_pedro, 'Pedro Núñez', 'Pedro', 'Núñez', 'V-17666555', 'V-17666555',
     'tecnico', 'aprobado', 'cv_completado', 'Técnico de redes', 'RED',
     v_entidad, v_p_ambar, 'pedro.nunez.demo@example.invalid'),
    (v_e_sofia, 'Sofía Blanco', 'Sofía', 'Blanco', 'V-22333444', 'V-22333444',
     'tecnico', 'aprobado', 'cv_completado', 'Instalador CCTV', 'INST_CCTV',
     v_entidad, v_p_ambar, 'sofia.blanco.demo@example.invalid'),
    (v_e_miguel, 'Miguel Torres', 'Miguel', 'Torres', 'V-15555666', 'V-15555666',
     'tecnico', 'aprobado', 'cv_completado', 'Instalador CCTV', 'INST_CCTV',
     v_entidad, v_p_rojo, 'miguel.torres.demo@example.invalid'),
    (v_e_elena, 'Elena Castro', 'Elena', 'Castro', 'V-16777888', 'V-16777888',
     'tecnico', 'aprobado', 'cv_completado', 'Instalador CCTV', 'INST_CCTV',
     v_entidad, v_p_rojo, 'elena.castro.demo@example.invalid'),
    (v_e_jorge, 'Jorge Silva', 'Jorge', 'Silva', 'V-14444555', 'V-14444555',
     'tecnico', 'aprobado', 'cv_completado', 'Eléctrico', 'ELECT',
     v_entidad, v_p_rojo, 'jorge.silva.demo@example.invalid')
  on conflict (id) do update
    set nombre_completo = excluded.nombre_completo,
        cargo_nombre = excluded.cargo_nombre,
        entidad_id = excluded.entidad_id,
        proyecto_modulo_id = excluded.proyecto_modulo_id;

  -- ci_obra_empleados omitido: en producción obra_id referencia ci_obras, no ci_proyectos.

  insert into public.ci_jornales_obra_tarifas (proyecto_id, empleado_id, costo_jornal_usd, seed_tag)
  values
    (v_p_verde, v_e_ana, 28, v_tag), (v_p_verde, v_e_luis, 32, v_tag), (v_p_verde, v_e_carla, 18, v_tag),
    (v_p_ambar, v_e_pedro, 30, v_tag), (v_p_ambar, v_e_sofia, 28, v_tag),
    (v_p_rojo, v_e_miguel, 80, v_tag), (v_p_rojo, v_e_elena, 80, v_tag), (v_p_rojo, v_e_jorge, 32, v_tag)
  on conflict (proyecto_id, empleado_id) do update
    set costo_jornal_usd = excluded.costo_jornal_usd, seed_tag = excluded.seed_tag;

  -- Semana actual lun 2 – dom 8 nov 2026 (verde: 400 USD)
  insert into public.ci_jornales_obra_asistencias (
    proyecto_id, empleado_id, fecha, costo_jornal, origen, seed_tag
  )
  select v_p_verde, v_e_ana, d::date, 28, 'seed', v_tag
  from generate_series('2026-11-02'::date, '2026-11-07'::date, interval '1 day') d
  on conflict (proyecto_id, empleado_id, fecha) do nothing;

  insert into public.ci_jornales_obra_asistencias (
    proyecto_id, empleado_id, fecha, costo_jornal, origen, seed_tag
  )
  select v_p_verde, v_e_luis, d::date, 32, 'seed', v_tag
  from generate_series('2026-11-02'::date, '2026-11-06'::date, interval '1 day') d
  on conflict (proyecto_id, empleado_id, fecha) do nothing;

  insert into public.ci_jornales_obra_asistencias (
    proyecto_id, empleado_id, fecha, costo_jornal, origen, seed_tag
  )
  select v_p_verde, v_e_carla, d::date, 18, 'seed', v_tag
  from generate_series('2026-11-02'::date, '2026-11-05'::date, interval '1 day') d
  on conflict (proyecto_id, empleado_id, fecha) do nothing;

  -- Ámbar: semana actual + previa ≈ 496 USD
  insert into public.ci_jornales_obra_asistencias (
    proyecto_id, empleado_id, fecha, costo_jornal, origen, seed_tag
  )
  select v_p_ambar, v_e_pedro, d::date, 30, 'seed', v_tag
  from generate_series('2026-10-26'::date, '2026-11-06'::date, interval '1 day') d
  where extract(dow from d) between 1 and 5
  on conflict (proyecto_id, empleado_id, fecha) do nothing;

  insert into public.ci_jornales_obra_asistencias (
    proyecto_id, empleado_id, fecha, costo_jornal, origen, seed_tag
  )
  select v_p_ambar, v_e_sofia, d::date, 28, 'seed', v_tag
  from generate_series('2026-11-02'::date, '2026-11-06'::date, interval '1 day') d
  on conflict (proyecto_id, empleado_id, fecha) do nothing;

  insert into public.ci_jornales_obra_asistencias (
    proyecto_id, empleado_id, fecha, costo_jornal, origen, seed_tag
  )
  values
    (v_p_ambar, v_e_sofia, '2026-10-29', 28, 'seed', v_tag),
    (v_p_ambar, v_e_sofia, '2026-10-30', 28, 'seed', v_tag)
  on conflict (proyecto_id, empleado_id, fecha) do nothing;

  -- Rojo: 20+16 jornadas CCTV (límite contrato 10) + 10 de eléctrico. 20*80 + 16*80 + 10*32 = 3200
  insert into public.ci_jornales_obra_asistencias (
    proyecto_id, empleado_id, fecha, costo_jornal, origen, seed_tag
  )
  select v_p_rojo, v_e_miguel, d::date, 80, 'seed', v_tag
  from (
    select d
    from generate_series('2026-09-01'::date, '2026-11-08'::date, interval '1 day') d
    where extract(dow from d) between 1 and 5
    order by d
    limit 20
  ) s
  on conflict (proyecto_id, empleado_id, fecha) do nothing;

  insert into public.ci_jornales_obra_asistencias (
    proyecto_id, empleado_id, fecha, costo_jornal, origen, seed_tag
  )
  select v_p_rojo, v_e_elena, d::date, 80, 'seed', v_tag
  from (
    select d
    from generate_series('2026-09-15'::date, '2026-11-08'::date, interval '1 day') d
    where extract(dow from d) between 1 and 5
    order by d
    limit 16
  ) s
  on conflict (proyecto_id, empleado_id, fecha) do nothing;

  insert into public.ci_jornales_obra_asistencias (
    proyecto_id, empleado_id, fecha, costo_jornal, origen, seed_tag
  )
  select v_p_rojo, v_e_jorge, d::date, 32, 'seed', v_tag
  from (
    select d
    from generate_series('2026-10-01'::date, '2026-11-08'::date, interval '1 day') d
    where extract(dow from d) between 1 and 5
    order by d
    limit 10
  ) s
  on conflict (proyecto_id, empleado_id, fecha) do nothing;

  insert into public.ci_proyecto_desviacion_config (
    proyecto_id, umbral_desviacion_pct, umbral_materiales_pct, umbral_mano_obra_pct,
    limite_jornadas_instalacion, especialidad_limite, seed_tag
  )
  values
    (v_p_verde, 15, 15, 15, 40, 'Instalador CCTV', v_tag),
    (v_p_ambar, 15, 15, 15, 20, 'Instalador CCTV', v_tag),
    (v_p_rojo, 15, 15, 15, 10, 'Instalador CCTV', v_tag)
  on conflict (proyecto_id) do update
    set umbral_desviacion_pct = excluded.umbral_desviacion_pct,
        limite_jornadas_instalacion = excluded.limite_jornadas_instalacion,
        seed_tag = excluded.seed_tag;

  insert into public.ci_presupuesto_partidas (
    id, proyecto_id, codigo_partida, descripcion, unidad,
    cantidad_presupuestada, precio_unitario_estimado, monto_total_estimado,
    origen, capitulo_codigo, capitulo_descripcion, capitulo_orden
  )
  values
    ('a1111111-b222-4c33-8d44-000000000501', v_p_verde, '01.01', 'Cámaras y NVR', 'GLB', 1, 12000, 12000, 'seed_demo', '01', 'Materiales CCTV', 1),
    ('a1111111-b222-4c33-8d44-000000000502', v_p_verde, '02.01', 'Instalación y puesta en marcha', 'GLB', 1, 6000, 6000, 'seed_demo', '02', 'Instalación CCTV', 2),
    ('a1111111-b222-4c33-8d44-000000000503', v_p_verde, '03.01', 'Cableado estructurado', 'GLB', 1, 2000, 2000, 'seed_demo', '03', 'Cableado', 3),
    ('a1111111-b222-4c33-8d44-000000000504', v_p_ambar, '01.01', 'Switches y rack', 'GLB', 1, 9000, 9000, 'seed_demo', '01', 'Materiales de red', 1),
    ('a1111111-b222-4c33-8d44-000000000505', v_p_ambar, '02.01', 'Automatización y control', 'GLB', 1, 4000, 4000, 'seed_demo', '02', 'Automatización', 2),
    ('a1111111-b222-4c33-8d44-000000000506', v_p_ambar, '03.01', 'Mano de obra técnica', 'GLB', 1, 2000, 2000, 'seed_demo', '03', 'Mano de obra', 3),
    ('a1111111-b222-4c33-8d44-000000000507', v_p_rojo, '01.01', 'Cámaras, NVR y accesorios', 'GLB', 1, 5000, 5000, 'seed_demo', '01', 'Materiales CCTV', 1),
    ('a1111111-b222-4c33-8d44-000000000508', v_p_rojo, '02.01', 'Instalación CCTV', 'GLB', 1, 3000, 3000, 'seed_demo', '02', 'Instalación CCTV', 2),
    ('a1111111-b222-4c33-8d44-000000000509', v_p_rojo, '03.01', 'Enlace de red', 'GLB', 1, 2000, 2000, 'seed_demo', '03', 'Redes', 3)
  on conflict (id) do update
    set monto_total_estimado = excluded.monto_total_estimado,
        capitulo_codigo = excluded.capitulo_codigo,
        capitulo_descripcion = excluded.capitulo_descripcion;

  insert into public.global_inventory (
    id, sap_code, name, unit, average_weighted_cost, last_purchase_price, entidad_id
  )
  values
    (v_mat_cam, 'DEMO-CCTV-CAM-01', '[DEMO] Cámara IP 4MP', 'UND', 85, 85, v_entidad),
    (v_mat_sw, 'DEMO-NET-SW-08', '[DEMO] Switch PoE 8 puertos', 'UND', 120, 120, v_entidad),
    (v_mat_cab, 'DEMO-UTP-CAT6', '[DEMO] Cable UTP Cat6 (m)', 'M', 1.25, 1.25, v_entidad)
  on conflict (id) do update
    set average_weighted_cost = excluded.average_weighted_cost,
        last_purchase_price = excluded.last_purchase_price;

  insert into public.inv_ubicaciones (id, codigo, nombre, tipo, ci_proyecto_id, notas)
  values
    (v_ubi_alm, 'DEMO-ALM-JORNALES', '[DEMO] Almacén central tech', 'almacen_central', null, v_tag),
    (v_ubi_verde, 'DEMO-OBRA-CCTV-VERDE', '[DEMO] Obra CCTV Palos Grandes', 'obra', v_p_verde, v_tag),
    (v_ubi_ambar, 'DEMO-OBRA-RED-AMBAR', '[DEMO] Obra red Chacao', 'obra', v_p_ambar, v_tag),
    (v_ubi_rojo, 'DEMO-OBRA-CCTV-ROJO', '[DEMO] Obra CCTV Centro', 'obra', v_p_rojo, v_tag)
  on conflict (id) do update set notas = excluded.notas;

  insert into public.contabilidad_compras (
    id, invoice_number, supplier_rif, supplier_name, fecha,
    total_amount, moneda, moneda_original, monto_ves, monto_usd, tasa_bcv_ves_por_usd,
    origen, estado, proyecto_id, entidad_id, imputacion, notas
  )
  values
    (v_c_verde, 'DEMO-FAC-VERDE-001', 'J-11111111-1', '[DEMO] Suministros CCTV CA', '2026-10-20',
     8000, 'USD', 'USD', 292000, 8000, 36.5, 'seed_demo', 'REGISTRADA', v_p_verde, v_entidad, 'obra', v_tag),
    (v_c_ambar, 'DEMO-FAC-AMBAR-001', 'J-22222222-2', '[DEMO] Redes del Este CA', '2026-10-22',
     8500, 'USD', 'USD', 310250, 8500, 36.5, 'seed_demo', 'REGISTRADA', v_p_ambar, v_entidad, 'obra', v_tag),
    (v_c_rojo, 'DEMO-FAC-ROJO-001', 'J-33333333-3', '[DEMO] Seguridad Electrónica VE', '2026-10-15',
     6500, 'USD', 'USD', 237250, 6500, 36.5, 'seed_demo', 'REGISTRADA', v_p_rojo, v_entidad, 'obra', v_tag)
  on conflict (id) do update
    set monto_usd = excluded.monto_usd, proyecto_id = excluded.proyecto_id, notas = excluded.notas;

  delete from public.contabilidad_compra_lineas
  where compra_id in (v_c_verde, v_c_ambar, v_c_rojo);

  insert into public.contabilidad_compra_lineas (
    compra_id, descripcion, unidad, cantidad, precio_unitario, subtotal, material_id
  )
  values
    (v_c_verde, '[DEMO] Cámara IP 4MP', 'UND', 40, 85, 3400, v_mat_cam),
    (v_c_verde, '[DEMO] Switch PoE', 'UND', 20, 120, 2400, v_mat_sw),
    (v_c_verde, '[DEMO] Cable UTP', 'M', 1760, 1.25, 2200, v_mat_cab),
    (v_c_ambar, '[DEMO] Switch PoE', 'UND', 40, 120, 4800, v_mat_sw),
    (v_c_ambar, '[DEMO] Cámara IP', 'UND', 20, 85, 1700, v_mat_cam),
    (v_c_ambar, '[DEMO] Cable UTP', 'M', 1600, 1.25, 2000, v_mat_cab),
    (v_c_rojo, '[DEMO] Cámara IP', 'UND', 50, 85, 4250, v_mat_cam),
    (v_c_rojo, '[DEMO] Switch PoE', 'UND', 10, 120, 1200, v_mat_sw),
    (v_c_rojo, '[DEMO] Cable UTP', 'M', 840, 1.25, 1050, v_mat_cab);

  insert into public.inv_egresos_campo (
    id, proyecto_id, origen_ubicacion_id, destino_ubicacion_id,
    obrero_nombre, obrero_oficio, observaciones, fecha_egreso, stock_aplicado
  )
  values
    (v_eg_verde, v_p_verde, v_ubi_alm, v_ubi_verde, 'Ana Rivas', 'Instalador CCTV', v_tag, '2026-10-28', false),
    (v_eg_ambar, v_p_ambar, v_ubi_alm, v_ubi_ambar, 'Pedro Núñez', 'Técnico de redes', v_tag, '2026-10-29', false),
    (v_eg_rojo, v_p_rojo, v_ubi_alm, v_ubi_rojo, 'Miguel Torres', 'Instalador CCTV', v_tag, '2026-10-18', false)
  on conflict (id) do update set observaciones = excluded.observaciones;

  delete from public.inv_egresos_campo_lineas
  where egreso_id in (v_eg_verde, v_eg_ambar, v_eg_rojo);

  insert into public.inv_egresos_campo_lineas (
    egreso_id, material_id, cantidad, unidad, material_nombre
  )
  values
    (v_eg_verde, v_mat_cam, 40, 'UND', '[DEMO] Cámara IP 4MP'),
    (v_eg_verde, v_mat_sw, 8, 'UND', '[DEMO] Switch PoE 8 puertos'),
    (v_eg_verde, v_mat_cab, 512, 'M', '[DEMO] Cable UTP Cat6 (m)'),
    (v_eg_ambar, v_mat_cam, 20, 'UND', '[DEMO] Cámara IP 4MP'),
    (v_eg_ambar, v_mat_sw, 16, 'UND', '[DEMO] Switch PoE 8 puertos'),
    (v_eg_ambar, v_mat_cab, 944, 'M', '[DEMO] Cable UTP Cat6 (m)'),
    (v_eg_rojo, v_mat_cam, 12, 'UND', '[DEMO] Cámara IP 4MP'),
    (v_eg_rojo, v_mat_sw, 4, 'UND', '[DEMO] Switch PoE 8 puertos'),
    (v_eg_rojo, v_mat_cab, 160, 'M', '[DEMO] Cable UTP Cat6 (m)');

  insert into public.ci_seed_demo_filas (tabla, fila_id, seed_tag)
  values
    ('ci_entidades', v_entidad, v_tag),
    ('customers', v_customer, v_tag),
    ('ci_proyectos', v_p_verde, v_tag),
    ('ci_proyectos', v_p_ambar, v_tag),
    ('ci_proyectos', v_p_rojo, v_tag),
    ('ci_empleados', v_e_ana, v_tag),
    ('ci_empleados', v_e_luis, v_tag),
    ('ci_empleados', v_e_carla, v_tag),
    ('ci_empleados', v_e_pedro, v_tag),
    ('ci_empleados', v_e_sofia, v_tag),
    ('ci_empleados', v_e_miguel, v_tag),
    ('ci_empleados', v_e_elena, v_tag),
    ('ci_empleados', v_e_jorge, v_tag),
    ('global_inventory', v_mat_cam, v_tag),
    ('global_inventory', v_mat_sw, v_tag),
    ('global_inventory', v_mat_cab, v_tag),
    ('inv_ubicaciones', v_ubi_alm, v_tag),
    ('inv_ubicaciones', v_ubi_verde, v_tag),
    ('inv_ubicaciones', v_ubi_ambar, v_tag),
    ('inv_ubicaciones', v_ubi_rojo, v_tag),
    ('contabilidad_compras', v_c_verde, v_tag),
    ('contabilidad_compras', v_c_ambar, v_tag),
    ('contabilidad_compras', v_c_rojo, v_tag),
    ('inv_egresos_campo', v_eg_verde, v_tag),
    ('inv_egresos_campo', v_eg_ambar, v_tag),
    ('inv_egresos_campo', v_eg_rojo, v_tag),
    ('ci_presupuesto_partidas', 'a1111111-b222-4c33-8d44-000000000501', v_tag),
    ('ci_presupuesto_partidas', 'a1111111-b222-4c33-8d44-000000000502', v_tag),
    ('ci_presupuesto_partidas', 'a1111111-b222-4c33-8d44-000000000503', v_tag),
    ('ci_presupuesto_partidas', 'a1111111-b222-4c33-8d44-000000000504', v_tag),
    ('ci_presupuesto_partidas', 'a1111111-b222-4c33-8d44-000000000505', v_tag),
    ('ci_presupuesto_partidas', 'a1111111-b222-4c33-8d44-000000000506', v_tag),
    ('ci_presupuesto_partidas', 'a1111111-b222-4c33-8d44-000000000507', v_tag),
    ('ci_presupuesto_partidas', 'a1111111-b222-4c33-8d44-000000000508', v_tag),
    ('ci_presupuesto_partidas', 'a1111111-b222-4c33-8d44-000000000509', v_tag)
  on conflict (tabla, fila_id) do nothing;
end $$;

notify pgrst, 'reload schema';


