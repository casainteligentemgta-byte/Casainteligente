-- Idempotencia para Telegram: evita duplicados por reintentos de red (3G/H+).

alter table public.ci_facturas_canal_pendientes
  add column if not exists telegram_message_id text;

alter table public.ci_facturas_canal_pendientes
  drop constraint if exists ci_facturas_canal_pendientes_estado_check;

alter table public.ci_facturas_canal_pendientes
  add constraint ci_facturas_canal_pendientes_estado_check
  check (estado in ('recibido', 'pendiente', 'procesando', 'extraido', 'confirmado', 'rechazado', 'error'));

create unique index if not exists ux_ci_facturas_canal_telegram_message_id
  on public.ci_facturas_canal_pendientes (telegram_message_id)
  where telegram_message_id is not null;

comment on column public.ci_facturas_canal_pendientes.telegram_message_id is
  'message_id de Telegram para deduplicar reintentos del webhook.';

notify pgrst, 'reload schema';

