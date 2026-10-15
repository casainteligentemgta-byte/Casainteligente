-- Funciones SECURITY DEFINER que solo debe ejecutar el servidor (clave service_role).
--
-- Antes: cualquier usuario con sesión podía llamarlas por /rest/v1/rpc/... saltándose
-- los permisos de la app (por ejemplo, admin_asignar_rol_entidad daba cualquier rol a
-- cualquier correo). El acceso anónimo ya estaba retirado.
--
-- Se verificó que ninguna se llama desde el navegador ni con la sesión del usuario:
-- todas las llamadas vienen de rutas API, Telegram o scripts con service_role, o de
-- otras funciones (que corren como su dueño, postgres, y no se ven afectadas).
--
-- Fuera de esta migración:
--   * ci_registrar_inyeccion_capital (2 firmas) y ci_registrar_abono_cliente: sus rutas
--     las llamaban con la sesión del usuario → ver 357, que se aplica tras el despliegue.
--   * ci_asegurar_ubicacion_obra y get_stock_real_obra: las usa el navegador (inventario,
--     filtros de almacén). Siguen abiertas a usuarios con sesión; son de bajo riesgo.

do $$
declare
  f text;
  firmas text[] := array[
    'public.admin_asignar_rol_entidad(text, public.ci_rol_sistema, uuid)',
    'public.ci_clear_registros_gastos_staging()',
    'public.ci_commit_registros_gastos_from_staging()',
    'public.ci_commit_registros_gastos_from_staging(uuid)',
    'public.ci_conciliar_factura_con_recepcion_campo(uuid, uuid, uuid)',
    'public.ci_conciliar_frm_con_factura_canal(uuid, uuid, jsonb, text, numeric, numeric, uuid)',
    'public.ci_liquidar_maquinaria_intercompany(uuid, date, date, numeric, uuid)',
    'public.ci_listar_ubicaciones_validas_obra(uuid)',
    'public.ci_procesar_conciliacion_compra(uuid, numeric, jsonb)',
    'public.ci_registrar_ingreso_manual_campo(uuid, uuid, uuid, character varying, character varying, jsonb, uuid, uuid)',
    'public.ci_sincronizar_desde_suegro(uuid)',
    'public.ci_stock_resultante_por_movimientos(uuid[])',
    'public.ci_telegram_marcar_ttl_pendiente(text)',
    'public.ingresar_mercancia_almacen(uuid, text, jsonb)',
    'public.inv_material_es_gasto_inmediato(uuid)',
    'public.inv_stock_apply_delta(uuid, uuid, numeric, numeric, numeric, text, text, uuid, uuid, text)',
    'public.obtener_lineas_para_depositario(uuid)'
  ];
begin
  foreach f in array firmas loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
