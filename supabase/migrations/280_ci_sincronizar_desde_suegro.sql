-- Función para sincronizar datos desde la BD del suegro a la BD local
-- Lee de suegro_db.transacciones y hace JOIN con las tablas de catálogo
-- para obtener los nombres en texto, luego inserta en registros_gastos.

CREATE OR REPLACE FUNCTION public.ci_sincronizar_desde_suegro(p_proyecto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int;
  v_deleted int;
BEGIN
  IF p_proyecto_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere un proyecto_id local para guardar los registros sincronizados.';
  END IF;

  -- 1. Borrar los registros anteriores de este proyecto para evitar duplicados
  -- (Asumimos que la sincronización es un reemplazo total, como el import de CSV)
  DELETE FROM public.registros_gastos
  WHERE proyecto_id = p_proyecto_id;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- 2. Insertar los datos cruzando las tablas remotas
  INSERT INTO public.registros_gastos (
    proyecto_id,
    clase,
    fecha,
    proveedor,
    tipo,
    capitulo,
    subcapitulo,
    descripcion,
    contrato_vinculado,
    moneda,
    tasa,
    monto_orig,
    monto_base_usd,
    monto_pagado,
    forma_pago,
    link_factura,
    link_comprobante,
    estado,
    honorarios,
    costo_total,
    porcentaje_admin,
    tasa_binance,
    tasa_usada,
    porcentaje_brecha_real,
    pool_asignado,
    avance_fisico
  )
  SELECT
    p_proyecto_id, -- El ID del proyecto en TU base de datos
    t.clase,
    t.fecha,
    prov.nombre AS proveedor,
    tg.nombre AS tipo,
    cap.nombre AS capitulo,
    subcap.nombre AS subcapitulo,
    t.descripcion,
    t.contrato_vinculado,
    t.moneda,
    t.tasa,
    t.monto_orig,
    t.monto_base_usd,
    t.monto_pagado,
    fp.nombre AS forma_pago,
    t.link_factura,
    t.link_comprobante,
    t.estado,
    t.honorarios,
    t.costo_total,
    t.porcentaje_admin,
    t.tasa_binance,
    t.tasa_usada,
    t.porcentaje_brecha_real,
    t.pool_asignado,
    t.avance_fisico
  FROM suegro_db.transacciones t
  LEFT JOIN suegro_db.proveedores prov ON t.proveedor_id = prov.id
  LEFT JOIN suegro_db.tipos_gasto tg ON t.tipo_gasto_id = tg.id
  LEFT JOIN suegro_db.estructura_costos cap ON t.capitulo_id = cap.id
  LEFT JOIN suegro_db.estructura_costos subcap ON t.subcapitulo_id = subcap.id
  LEFT JOIN suegro_db.formas_pago fp ON t.forma_pago_id = fp.id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'mensaje', 'Sincronización completada exitosamente',
    'registros_borrados', v_deleted,
    'registros_insertados', v_inserted
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ci_sincronizar_desde_suegro(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_sincronizar_desde_suegro(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
