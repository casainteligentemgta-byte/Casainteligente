-- Condición de pago y vencimiento de crédito en compras (purchase_invoices).
-- contado: sin vencimiento. credito: fecha_vencimiento = date + dias_credito.

ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS condicion_pago text,
  ADD COLUMN IF NOT EXISTS dias_credito integer,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date;

ALTER TABLE public.purchase_invoices
  DROP CONSTRAINT IF EXISTS purchase_invoices_condicion_pago_check;
ALTER TABLE public.purchase_invoices
  ADD CONSTRAINT purchase_invoices_condicion_pago_check
  CHECK (condicion_pago IS NULL OR condicion_pago IN ('contado', 'credito'));

CREATE INDEX IF NOT EXISTS purchase_invoices_fecha_vencimiento_idx
  ON public.purchase_invoices (fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;
