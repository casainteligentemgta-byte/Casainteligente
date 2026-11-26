-- 407 · Mensaje de estado de lectura de factura en Telegram (se edita hasta terminar).
-- Aditivo. Idempotente. NO aplica cambios en producción por sí sola: hay que correrla
-- en el SQL Editor / pipeline de migraciones cuando el dueño lo apruebe.
-- El código funciona sin esta columna (si falta, el aviso final llega como mensaje nuevo).

alter table public.ci_facturas_canal_pendientes
  add column if not exists telegram_status_message_id bigint;

comment on column public.ci_facturas_canal_pendientes.telegram_status_message_id is
  'message_id del mensaje «Leyendo factura…» del bot; se edita a ✅ / ❌ al terminar o al reintentar.';

-- Búsqueda barata de lecturas atascadas (barrido cada pocos minutos).
create index if not exists idx_ci_facturas_canal_procesando
  on public.ci_facturas_canal_pendientes (updated_at)
  where estado = 'procesando';

notify pgrst, 'reload schema';
