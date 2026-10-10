-- Inventario, compras, fondos de clientes y nómina de obra: solo con sesión.
--
-- Antes, con la llave pública del sitio (la que viaja en el navegador) cualquiera podía,
-- sin iniciar sesión:
--   · leer, crear, modificar y borrar traspasos, stock, ubicaciones, facturas de compra,
--     fondos y abonos de clientes, y la nómina de cada obra (cédulas y teléfonos);
--   · llamar funciones que mueven stock o registran abonos (inv_stock_apply_delta,
--     ci_registrar_abono_cliente, …).
--
-- Regla aplicada: lo que podía hacer «cualquiera» pasa a poder hacerlo solo quien tiene
-- sesión. No se le quita nada al personal con sesión ni al servidor (bot de Telegram y
-- rutas API usan service_role, que no pasa por estas políticas).
--
-- Efecto colateral buscado: varias tablas solo tenían política para «anon», así que el
-- personal con sesión no veía nada al leerlas desde el navegador (p. ej. fondos del
-- proyecto en Finanzas). Ahora sí.
--
-- Idempotente: una segunda ejecución no encuentra nada que cambiar.

do $$
declare
  t text;
  p record;
  f record;
  ya_cubierta boolean;
  nuevo_nombre text;
  -- Tablas con políticas abiertas a anon/public que se convierten a «authenticated».
  tablas text[] := array[
    -- inventario
    'inv_ubicaciones', 'inv_movimientos', 'inv_egresos_campo', 'inv_egresos_campo_lineas',
    'inv_despacho_alertas_proyecto', 'inv_discrepancias_recepcion', 'inventario_stock',
    'transferencias_inventario', 'transferencias_inventario_lineas',
    'detalle_transferencia_partidas', 'series_productos', 'obra_partidas_materiales',
    'global_inventory', 'inventory_alerts', 'inventory_deposits', 'inventory_furniture',
    'inventory_movements', 'inventory_units', 'material_categories',
    'ci_obra_movimientos_material', 'ci_catalogos_entidad', 'ci_inventario_reorden_obra',
    -- compras y recepción
    'compras_facturas', 'compras_factura_lineas', 'purchase_invoices', 'purchase_details',
    'quality_inspections', 'ci_recepciones_campo', 'ci_recepciones_campo_lineas',
    'ci_facturas_canal_pendientes', 'ci_compras_capitulos_maestro', 'ci_alertas_config',
    'contabilidad_compras', 'contabilidad_compra_lineas', 'ci_compras_retiros',
    -- procuras y bot
    'ci_procuras', 'ci_procura_estados_historial', 'ci_usuarios_sistema_telegram',
    'ci_telegram_whitelist', 'ci_telegram_estados',
    -- dinero de clientes y personas de la obra
    'ci_proyecto_fondos', 'ci_proyecto_abonos', 'ci_valuaciones_delegadas',
    'ci_proyecto_nomina'
  ];
  -- Funciones que escriben o exponen inventario / fondos y eran ejecutables sin sesión.
  funciones text[] := array[
    'inv_stock_apply_delta', 'inv_material_es_gasto_inmediato', 'get_stock_real_obra',
    'ingresar_mercancia_almacen', 'obtener_lineas_para_depositario',
    'ci_stock_resultante_por_movimientos', 'ci_asegurar_ubicacion_obra',
    'ci_registrar_ingreso_manual_campo', 'ci_conciliar_factura_con_recepcion_campo',
    'ci_conciliar_frm_con_factura_canal', 'ci_procesar_conciliacion_compra',
    'ci_diagnostico_descalce_procuras', 'ci_diagnostico_descalce_procuras_debug',
    'ci_registrar_abono_cliente', 'ci_registrar_inyeccion_capital',
    'ci_liquidar_maquinaria_intercompany', 'ci_telegram_marcar_ttl_pendiente'
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
