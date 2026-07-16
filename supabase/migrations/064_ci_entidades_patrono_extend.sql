-- Patrono: datos extendidos para contratos (representante, mercantil, permisología, logos).

alter table public.ci_entidades
  add column if not exists nombre_comercial text,
  add column if not exists direccion_fiscal text,
  add column if not exists rep_legal_nombre text,
  add column if not exists rep_legal_cedula text,
  add column if not exists rep_legal_cargo text,
  add column if not exists registro_mercantil jsonb not null default '{}'::jsonb,
  add column if not exists permisologia jsonb not null default '{}'::jsonb,
  add column if not exists logo_url text,
  add column if not exists sello_url text;

comment on column public.ci_entidades.nombre is
  'Razón social / nombre legal del patrono.';
comment on column public.ci_entidades.nombre_comercial is
  'Nombre comercial (marca) si difiere de la razón social.';
comment on column public.ci_entidades.direccion_fiscal is
  'Domicilio fiscal o sede principal.';
comment on column public.ci_entidades.registro_mercantil is
  'JSON: tomo, numero, fecha, circunscripcion.';
comment on column public.ci_entidades.permisologia is
  'JSON: ivss_vence, inces_vence, solvencia_laboral_vence (fechas ISO YYYY-MM-DD).';
comment on column public.ci_entidades.logo_url is
  'URL pública del logo (Storage o externa).';
comment on column public.ci_entidades.sello_url is
  'URL pública del sello/firma gráfica.';

notify pgrst, 'reload schema';
