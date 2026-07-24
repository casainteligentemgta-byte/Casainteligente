-- Límite Fast-Track OCR (USD) configurable por proyecto (antes hardcodeado $100).

alter table public.ci_proyectos
  add column if not exists limite_fast_track_usd numeric(12, 2) not null default 100.00
    check (limite_fast_track_usd >= 0);

comment on column public.ci_proyectos.limite_fast_track_usd is
  'Umbral máximo en USD para auto-aprobación Fast-Track OCR (Telegram/canal). Por defecto 100.';

notify pgrst, 'reload schema';
