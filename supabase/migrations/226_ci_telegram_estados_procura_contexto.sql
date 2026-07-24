-- Ampliar contextos válidos en ci_telegram_estados (alineado con lib/telegram/estados.ts).

alter table public.ci_telegram_estados
  drop constraint if exists ci_telegram_estados_contexto_check;

alter table public.ci_telegram_estados
  add constraint ci_telegram_estados_contexto_check
  check (contexto in (
    'menu',
    'factura',
    'obra',
    'gasto_obra',
    'esperando_audio_bitacora',
    'entrada_obra',
    'salida_obra',
    'avance_campo',
    'avance_campo_cantidad',
    'memoria_obra',
    'memoria_obra_foto',
    'depositario_recepcion',
    'traspaso_inventario',
    'consulta_stock',
    'procura_solicitud'
  ));

comment on table public.ci_telegram_estados is
  'Estado de sesión Telegram por chat (contexto, obra activa, metadata del flujo).';

notify pgrst, 'reload schema';
