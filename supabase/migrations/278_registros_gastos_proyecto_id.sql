-- Multi-obra: registros_gastos / staging llevan proyecto_id.
-- Import CSV diario reemplaza SOLO las filas de esa obra (no trunca el libro global).

ALTER TABLE public.registros_gastos
  ADD COLUMN IF NOT EXISTS proyecto_id uuid REFERENCES public.ci_proyectos(id) ON DELETE CASCADE;

ALTER TABLE public.registros_gastos_staging
  ADD COLUMN IF NOT EXISTS proyecto_id uuid;

-- Histórico RANCHO ya importado (sin obra) → Flamboyant.
UPDATE public.registros_gastos
SET proyecto_id = '171694ed-0ecb-4ec5-82f5-82b980cb261f'::uuid
WHERE proyecto_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_registros_gastos_proyecto
  ON public.registros_gastos (proyecto_id);

CREATE INDEX IF NOT EXISTS idx_registros_gastos_proyecto_clase
  ON public.registros_gastos (proyecto_id, clase);

COMMENT ON COLUMN public.registros_gastos.proyecto_id IS
  'Obra dueña del libro CSV (import diario reemplaza solo esta obra).';

-- Commit por obra: borra solo filas de p_proyecto_id e inserta desde staging.
CREATE OR REPLACE FUNCTION public.ci_commit_registros_gastos_from_staging(p_proyecto_id uuid)
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
  IF p_proyecto_id IS NULL THEN
    RAISE EXCEPTION 'proyecto_id requerido para commit de registros_gastos';
  END IF;

  SELECT count(*)::int INTO v_staging FROM public.registros_gastos_staging;
  IF v_staging <= 0 THEN
    RAISE EXCEPTION 'Staging vacío: no hay filas para reemplazar registros_gastos';
  END IF;

  -- Asegura proyecto_id en staging (por si el cliente no lo envió en cada fila).
  UPDATE public.registros_gastos_staging
  SET proyecto_id = p_proyecto_id
  WHERE proyecto_id IS NULL;

  DELETE FROM public.registros_gastos
  WHERE proyecto_id = p_proyecto_id;

  INSERT INTO public.registros_gastos (
    clase, fecha, proveedor, tipo, capitulo, subcapitulo, descripcion,
    contrato_vinculado, moneda, tasa, monto_orig, monto_base_usd, monto_pagado,
    forma_pago, link_factura, link_comprobante, estado, honorarios, costo_total,
    porcentaje_admin, tasa_binance, tasa_usada, porcentaje_brecha_real,
    pool_asignado, avance_fisico, proyecto_id
  )
  SELECT
    clase, fecha, proveedor, tipo, capitulo, subcapitulo, descripcion,
    contrato_vinculado, moneda, tasa, monto_orig, monto_base_usd, monto_pagado,
    forma_pago, link_factura, link_comprobante, estado, honorarios, costo_total,
    porcentaje_admin, tasa_binance, tasa_usada, porcentaje_brecha_real,
    pool_asignado, avance_fisico,
    COALESCE(proyecto_id, p_proyecto_id)
  FROM public.registros_gastos_staging;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  TRUNCATE TABLE public.registros_gastos_staging;

  SELECT count(*)::int INTO v_total
  FROM public.registros_gastos
  WHERE proyecto_id = p_proyecto_id;

  IF v_total <> v_inserted THEN
    RAISE EXCEPTION 'Conteo inconsistente tras replace obra %: inserted=% total=%',
      p_proyecto_id, v_inserted, v_total;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'total', v_total,
    'proyecto_id', p_proyecto_id,
    'staging_before', v_staging
  );
END;
$$;

-- Compat: firma sin args ya no trunca todo el libro (evita borrar otras obras).
CREATE OR REPLACE FUNCTION public.ci_commit_registros_gastos_from_staging()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'Use ci_commit_registros_gastos_from_staging(proyecto_id uuid). El replace global está deshabilitado.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.ci_commit_registros_gastos_from_staging(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_commit_registros_gastos_from_staging(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ci_commit_registros_gastos_from_staging() TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_commit_registros_gastos_from_staging() TO authenticated;

NOTIFY pgrst, 'reload schema';
