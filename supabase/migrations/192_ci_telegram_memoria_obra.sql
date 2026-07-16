-- Contextos Telegram: memoria descriptiva fotográfica de avance por partida.

alter table public.ci_telegram_estados
  drop constraint if exists ci_telegram_estados_contexto_check;

alter table public.ci_telegram_estados
  add constraint ci_telegram_estados_contexto_check
  check (contexto in (
    'menu', 'factura', 'obra', 'gasto_obra', 'esperando_audio_bitacora',
    'entrada_obra', 'salida_obra', 'avance_campo', 'avance_campo_cantidad',
    'memoria_obra', 'memoria_obra_foto'
  ));

notify pgrst, 'reload schema';
