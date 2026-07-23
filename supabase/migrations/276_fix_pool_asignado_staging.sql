-- 276 (refuerzo): recrea staging con tipos alineados + casts seguros en el COMMIT.
-- En SQL Editor es normal ver "Success. No rows returned".

DROP FUNCTION IF EXISTS public.ci_commit_registros_gastos_from_staging();
DROP FUNCTION IF EXISTS public.ci_clear_registros_gastos_staging();
DROP TABLE IF EXISTS public.registros_gastos_staging;

CREATE TABLE public.registros_gastos_staging (
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

CREATE OR REPLACE FUNCTION public.ci_clear_registros_gastos_staging()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE TABLE public.registros_gastos_staging;
END;
$$;

CREATE OR REPLACE FUNCTION public.ci_commit_registros_gastos_from_staging()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staging int;
  v_inserted int;
  v_total int;
BEGIN
  SELECT count(*)::int INTO v_staging FROM public.registros_gastos_staging;
  IF v_staging <= 0 THEN
    RAISE EXCEPTION 'Staging vacío: no hay filas para reemplazar registros_gastos';
  END IF;

  TRUNCATE TABLE public.registros_gastos RESTART IDENTITY;

  INSERT INTO public.registros_gastos (
    clase, fecha, proveedor, tipo, capitulo, subcapitulo, descripcion,
    contrato_vinculado, moneda, tasa, monto_orig, monto_base_usd, monto_pagado,
    forma_pago, link_factura, link_comprobante, estado, honorarios, costo_total,
    porcentaje_admin, tasa_binance, tasa_usada, porcentaje_brecha_real,
    pool_asignado, avance_fisico
  )
  SELECT
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
  FROM public.registros_gastos_staging;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  TRUNCATE TABLE public.registros_gastos_staging;
  SELECT count(*)::int INTO v_total FROM public.registros_gastos;

  IF v_total <> v_inserted THEN
    RAISE EXCEPTION 'Conteo inconsistente tras replace: inserted=% total=%', v_inserted, v_total;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'total', v_total,
    'staging_before', v_staging
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ci_clear_registros_gastos_staging() TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_clear_registros_gastos_staging() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ci_commit_registros_gastos_from_staging() TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_commit_registros_gastos_from_staging() TO authenticated;

ALTER TABLE public.registros_gastos_staging ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'registros_gastos_staging'
      AND policyname = 'registros_gastos_staging_all_auth'
  ) THEN
    CREATE POLICY registros_gastos_staging_all_auth
      ON public.registros_gastos_staging FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verificación (esto SÍ debe devolver 1 fila):
SELECT
  a.attname AS column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'registros_gastos_staging'
  AND a.attname = 'pool_asignado'
  AND a.attnum > 0
  AND NOT a.attisdropped;
