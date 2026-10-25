-- Chat de Telegram del chofer (Flota). Permite que el comprador elija un chofer al cargar
-- una factura y que el retiro de la mercancía le llegue solo a él.
alter table public.ci_flota_conductores
  add column if not exists telegram_chat_id bigint null;

create unique index if not exists ci_flota_conductores_telegram_chat_id_uidx
  on public.ci_flota_conductores (telegram_chat_id)
  where telegram_chat_id is not null;

notify pgrst, 'reload schema';
