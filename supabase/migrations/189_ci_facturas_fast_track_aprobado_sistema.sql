-- Fast-Track OCR: estado aprobado_sistema sin revisión manual en cola Telegram.

alter table public.ci_facturas_canal_pendientes
  drop constraint if exists ci_facturas_canal_pendientes_estado_check;

alter table public.ci_facturas_canal_pendientes
  add constraint ci_facturas_canal_pendientes_estado_check
  check (estado in (
    'recibido',
    'pendiente',
    'procesando',
    'extraido',
    'aprobado_sistema',
    'confirmado',
    'rechazado',
    'error'
  ));

comment on constraint ci_facturas_canal_pendientes_estado_check on public.ci_facturas_canal_pendientes is
  'aprobado_sistema = fast-track OCR (>95% confianza, SKU exacto, monto < $100 USD).';

notify pgrst, 'reload schema';
