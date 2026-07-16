-- Alinea contabilidad_compras con otras tablas CI; evita error PostgREST si algún
-- cliente legacy envía updated_at en PATCH/INSERT.

ALTER TABLE public.contabilidad_compras
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.contabilidad_compras.updated_at IS
  'Última modificación del registro (auditoría).';

NOTIFY pgrst, 'reload schema';
