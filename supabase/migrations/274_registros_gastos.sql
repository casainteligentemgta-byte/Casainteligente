-- Histórico CCO V4 / CSV RANCHO (maestro de movimientos).
-- Si la tabla ya existe (import manual), este script no la recrea.

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
  'Libro maestro histórico CCO (CSV RANCHO / V4). Fuente primaria del libro cuando tiene filas.';

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

NOTIFY pgrst, 'reload schema';
