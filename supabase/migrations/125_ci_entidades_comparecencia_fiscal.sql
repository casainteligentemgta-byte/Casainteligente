-- Columnas opcionales para comparecencia del patrono en contratos PDF (fallback si no hay ubicación en registro_mercantil).

alter table public.ci_entidades
  add column if not exists domicilio_fiscal text,
  add column if not exists municipio_fiscal text,
  add column if not exists estado_fiscal text;

comment on column public.ci_entidades.domicilio_fiscal is
  'Domicilio de la sede (sinónimo opcional de dirección fiscal para PostgREST / PDF).';
comment on column public.ci_entidades.municipio_fiscal is
  'Municipio de la sede; si falta, puede usarse registro_mercantil.domicilio_municipio_registro.';
comment on column public.ci_entidades.estado_fiscal is
  'Estado federado de la sede; si falta, puede usarse registro_mercantil.domicilio_estado_registro.';

notify pgrst, 'reload schema';
