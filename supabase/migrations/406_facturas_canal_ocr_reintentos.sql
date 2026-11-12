-- 406 · Reintentos automáticos de OCR en facturas del canal (Telegram/WhatsApp).
-- Aditivo. Idempotente. NO aplica cambios en producción por sí sola: hay que correrla
-- en el SQL Editor / pipeline de migraciones cuando el dueño lo apruebe.
-- (405 ya es 405_contabilidad_credito_pagos.)

alter table public.ci_facturas_canal_pendientes
  add column if not exists ocr_intentos integer not null default 0,
  add column if not exists ocr_proximo_reintento_at timestamptz;

comment on column public.ci_facturas_canal_pendientes.ocr_intentos is
  'Intentos de extracción IA sobre la foto ya guardada (máx. 3: 1 inicial + 2 reintentos transitorios).';
comment on column public.ci_facturas_canal_pendientes.ocr_proximo_reintento_at is
  'Si un intento se encadena a otra invocación (timeout serverless), cuándo volver a leer la misma foto.';

create index if not exists idx_ci_facturas_canal_ocr_reintento
  on public.ci_facturas_canal_pendientes (ocr_proximo_reintento_at)
  where estado = 'error_ocr' and ocr_intentos > 0 and ocr_intentos < 3;

notify pgrst, 'reload schema';
