-- Nombres y apellidos separados en contratos express (contratación masiva / individual).
-- Antes: el insert enviaba obrero_nombres / obrero_apellidos pero la tabla solo tenía obrero_nombre
-- → PostgREST: Could not find the 'obrero_apellidos' column of 'ci_contratos_express' in the schema cache.

alter table public.ci_contratos_express
  add column if not exists obrero_nombres text;

alter table public.ci_contratos_express
  add column if not exists obrero_apellidos text;

comment on column public.ci_contratos_express.obrero_nombres is
  'Nombres del obrero (separados). El nombre completo sigue en obrero_nombre.';
comment on column public.ci_contratos_express.obrero_apellidos is
  'Apellidos del obrero (separados). El nombre completo sigue en obrero_nombre.';

notify pgrst, 'reload schema';
