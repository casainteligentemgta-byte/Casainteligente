-- Auditoría de fechas de factura (OCR / edición manual)
ALTER TABLE public.contabilidad_compras
  ADD COLUMN IF NOT EXISTS alerta_fecha text,
  ADD COLUMN IF NOT EXISTS fecha_confirmada_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contabilidad_compras.alerta_fecha IS
  'ok implícito = NULL; advertencia | critico según distancia de la fecha al día de registro';
COMMENT ON COLUMN public.contabilidad_compras.fecha_confirmada_manual IS
  'true cuando el usuario confirmó explícitamente una fecha marcada como crítica';
