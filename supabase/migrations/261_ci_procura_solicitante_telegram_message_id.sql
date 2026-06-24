-- Mensaje único editable al solicitante (ticket procura en Telegram).

alter table public.ci_procuras
  add column if not exists solicitante_telegram_message_id bigint;

comment on column public.ci_procuras.solicitante_telegram_message_id is
  'message_id del ticket único enviado al solicitante; se actualiza con editMessageText en cada paso del flujo.';

notify pgrst, 'reload schema';
