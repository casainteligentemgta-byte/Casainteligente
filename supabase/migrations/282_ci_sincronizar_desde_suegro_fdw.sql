-- 282 · Libro registros_gastos + sync FDW desde BD del suegro (suegro_db.*)
-- Prerrequisito en SQL Editor: foreign server / schema suegro_db (postgres_fdw).
-- Ver: supabase/sql_editor_suegro_fdw_prereq.sql

-- Histórico CCO V4 / CSV RANCHO (maestro de movimientos).
CREATE TABLE IF NOT EXISTS public.registros_gastos (
  id bigserial PRIMARY KEY,
  clase text,
  fecha timestamptz,
  proveedor text,
  tipo text,
  capitulo text,
  subcapitulo text,
  descripcion text,
  contrato_vinculado text,
  moneda text,
  tasa numeric,
  monto_orig numeric,
  monto_base_usd numeric,
  monto_pagado numeric,
  forma_pago text,
  link_factura text,
  link_comprobante text,
  estado text,
  honorarios numeric,
  costo_total numeric,
  porcentaje_admin numeric,
  tasa_binance numeric,
  tasa_usada text,
  porcentaje_brecha_real numeric,
  pool_asignado numeric,
  avance_fisico numeric
);

CREATE INDEX IF NOT EXISTS idx_registros_gastos_fecha ON public.registros_gastos (fecha DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_registros_gastos_clase ON public.registros_gastos (clase);
CREATE INDEX IF NOT EXISTS idx_registros_gastos_proveedor ON public.registros_gastos (proveedor);
CREATE INDEX IF NOT EXISTS idx_registros_gastos_capitulo ON public.registros_gastos (capitulo);

COMMENT ON TABLE public.registros_gastos IS
  'Libro maestro histórico CCO (CSV RANCHO / V4 / sync FDW suegro).';

ALTER TABLE public.registros_gastos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'registros_gastos' AND policyname = 'registros_gastos_select_auth'
  ) THEN
    CREATE POLICY registros_gastos_select_auth
      ON public.registros_gastos FOR SELECT TO authenticated
      USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'registros_gastos' AND policyname = 'registros_gastos_write_auth'
  ) THEN
    CREATE POLICY registros_gastos_write_auth
      ON public.registros_gastos FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_gastos TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.registros_gastos_id_seq TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.registros_gastos_staging (
  LIKE public.registros_gastos INCLUDING DEFAULTS
);
ALTER TABLE public.registros_gastos_staging DROP COLUMN IF EXISTS id;
ALTER TABLE public.registros_gastos_staging ADD COLUMN IF NOT EXISTS id bigserial;

ALTER TABLE public.registros_gastos
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES public.ci_proyectos(id) ON DELETE CASCADE;

ALTER TABLE public.registros_gastos_staging
  ADD COLUMN IF NOT EXISTS proyecto_id uuid;

CREATE INDEX IF NOT EXISTS idx_registros_gastos_proyecto
  ON public.registros_gastos (proyecto_id);

CREATE INDEX IF NOT EXISTS idx_registros_gastos_proyecto_clase
  ON public.registros_gastos (proyecto_id, clase);

COMMENT ON COLUMN public.registros_gastos.proyecto_id IS
  'Obra dueña del libro (sync FDW / import CSV reemplaza solo esta obra).';

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

  -- Verifica que exista el schema FDW (evita error críptico).
  IF to_regnamespace('suegro_db') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Falta el schema FDW suegro_db. Ejecute supabase/sql_editor_suegro_fdw_prereq.sql en el SQL Editor.'
    );
  END IF;

  DELETE FROM public.registros_gastos
  WHERE proyecto_id = p_proyecto_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

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
    p_proyecto_id,
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
