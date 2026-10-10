-- Contabilidad de obra, presupuestos, catálogos y vistas: solo con sesión.
-- Segunda parte de la migración 342 (inventario y compras).
--
-- Antes, con la llave pública del sitio (la que viaja en el navegador) cualquiera podía,
-- sin iniciar sesión:
--   · leer todas las compras por la vista «ci_compras» y el cuadro de procuras por
--     «vista_cuadro_procuras»: las vistas se saltaban el cierre de la 342;
--   · leer y modificar gastos de obra, contratos y presupuestos del CCO, partidas y
--     análisis de precios, catálogo de productos, ventas, archivos y equipos de proyecto;
--   · leer datos de personal por las vistas «workers», «ci_personal_activos» y «hojas_vida»;
--   · llamar funciones que asignan roles o cargan gastos (admin_asignar_rol_entidad, …).
--
-- Regla aplicada, igual que en la 342: lo que podía hacer «cualquiera» pasa a poder
-- hacerlo solo quien tiene sesión. No se le quita nada al personal con sesión ni al
-- servidor (bot de Telegram y rutas API usan service_role).
--
-- Lo que NO toca (queda para una etapa aparte): las tablas que usan los formularios
-- públicos de reclutamiento y registro de trabajadores (ci_empleados,
-- ci_contratos_empleado_obra, ci_examenes, ci_hojas_vida, recruitment_needs,
-- ci_proyectos, ci_obra_empleados, ci_config_nomina, …). Cerrarlas rompería esos
-- formularios mientras lean la base directamente desde el navegador.
--
-- Idempotente: una segunda ejecución no encuentra nada que cambiar.

do $$
declare
  t text;
  v text;
  p record;
  f record;
  ya_cubierta boolean;
  nuevo_nombre text;
  tablas text[] := array[
    -- contabilidad de obra (CCO) y gastos
    'cco_auditoria_eventos', 'cco_contratos_obra', 'cco_estructura_costos',
    'cco_presupuestos_capitulo', 'cco_proyecto_config', 'cco_snapshots', 'gastos_obra',
    -- presupuestos, partidas y catálogos
    'apu_items', 'capitulos', 'partidas', 'ci_presupuesto_partidas',
    'ci_presupuesto_partida_apu', 'ci_proyecto_presupuestos_lulo',
    'ci_lulo_import_snapshots', 'ci_lulo_insumos_maestro', 'lulo_catalogo_capitulos',
    'lulo_catalogo_insumos', 'lulo_catalogo_partida_insumos', 'lulo_catalogo_partidas',
    'computos_metricos', 'ci_metron_analisis', 'ci_metron_computos',
    'ci_fases_tecnicas_contrato',
    -- proyectos y obra
    'ci_obras', 'ci_bitacora_obras', 'ci_proyecto_archivos', 'ci_proyecto_equipos',
    'ci_proyecto_visitas', 'ci_proyecto_visita_archivos', 'ci_obra_tours',
    'ci_obra_tour_jobs', 'ci_notificaciones', 'obra_digital_daily_progress',
    'obra_digital_documents', 'obra_digital_labor_contracts',
    'obra_digital_tool_assignments',
    -- ventas, productos y proveedores
    'productos', 'ventas', 'venta_items', 'empresas',
    -- bot y registros de campo (los escribe el servidor)
    'bot_estados', 'ci_telegram_states', 'ci_registro_agua', 'registro_agua_obrero',
    -- tablas antiguas o de apoyo
    'canchas', 'dispositivos', 'error_logs', 'personas', 'proyectos'
  ];
  -- Las vistas no pasan por las políticas de sus tablas: se les quita el acceso sin sesión.
  vistas text[] := array[
    'ci_compras', 'vista_cuadro_procuras', 'insumos', 'composicion',
    'workers', 'salary_history', 'benefit_configs', 'ci_personal_activos',
    'ci_postulantes_reclutamiento', 'hojas_vida', 'global_labor_overview',
    'documentos_por_vencer'
  ];
  -- Funciones que asignan roles o escriben gastos y eran ejecutables sin sesión.
  funciones text[] := array[
    'admin_asignar_rol_entidad', 'ci_clear_registros_gastos_staging',
    'ci_commit_registros_gastos_from_staging', 'ci_entidad_inicializar_catalogo',
    'ci_listar_ubicaciones_validas_obra', 'ci_sincronizar_desde_suegro'
  ];
begin
  foreach t in array tablas loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    for p in
      select policyname, cmd, roles
      from pg_policies
      where schemaname = 'public'
        and tablename = t
        and roles && array['anon', 'public']::name[]
    loop
      -- ¿Otra política ya da lo mismo, sin condiciones, a quien tiene sesión?
      select exists (
        select 1
        from pg_policies o
        where o.schemaname = 'public'
          and o.tablename = t
          and o.policyname <> p.policyname
          and 'authenticated' = any (o.roles)
          and not (o.roles && array['anon', 'public']::name[])
          and (o.cmd = p.cmd or o.cmd = 'ALL')
          and coalesce(o.qual, 'true') = 'true'
          and coalesce(o.with_check, 'true') = 'true'
      ) into ya_cubierta;

      if ya_cubierta and p.roles = array['anon']::name[] then
        execute format('drop policy %I on public.%I', p.policyname, t);
      else
        execute format('alter policy %I on public.%I to authenticated', p.policyname, t);
        if p.policyname ~ '_anon$' then
          nuevo_nombre := regexp_replace(p.policyname, '_anon$', '_sesion');
          if not exists (
            select 1 from pg_policies
            where schemaname = 'public' and tablename = t and policyname = nuevo_nombre
          ) then
            execute format('alter policy %I on public.%I rename to %I', p.policyname, t, nuevo_nombre);
          end if;
        end if;
      end if;
    end loop;

    execute format('revoke all on public.%I from anon', t);
  end loop;

  foreach v in array vistas loop
    if to_regclass('public.' || v) is null then
      continue;
    end if;
    execute format('revoke all on public.%I from anon', v);
  end loop;

  for f in
    select pr.oid::regprocedure as firma
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
    where n.nspname = 'public'
      and pr.proname = any (funciones)
      and pr.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated, service_role', f.firma);
  end loop;
end
$$;

notify pgrst, 'reload schema';
