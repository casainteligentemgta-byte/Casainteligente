-- Contador opcional de interesados (p. ej. clics en enlaces de difusión / registro).
alter table public.recruitment_needs add column if not exists conteo_clics integer not null default 0;

comment on column public.recruitment_needs.conteo_clics is
  'Número de interesados asociados a la vacante (incremento vía app o jobs; por defecto 0).';

notify pgrst, 'reload schema';
