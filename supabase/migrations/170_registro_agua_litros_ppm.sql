-- Flujo /agua: litros ingresados por el usuario y PPM de prueba de minerales.

alter table public.bot_estados
  drop constraint if exists bot_estados_estado_check;

alter table public.bot_estados
  add constraint bot_estados_estado_check
  check (estado in (
    'ESPERANDO_FOTO_TANQUE',
    'ESPERANDO_FOTO_PRUEBA',
    'ESPERANDO_LITROS'
  ));

alter table public.registro_agua_obrero
  add column if not exists litros_entregados numeric(15, 2);

alter table public.registro_agua_obrero
  add column if not exists ppm_minerales numeric(15, 4);

comment on column public.registro_agua_obrero.litros_entregados is
  'Litros entregados ingresados por el obrero en Telegram tras las dos fotos.';
comment on column public.registro_agua_obrero.ppm_minerales is
  'PPM / TDS leído en foto de prueba de minerales (medidor azul).';

notify pgrst, 'reload schema';
