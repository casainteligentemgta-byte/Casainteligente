-- 312: Campos editables del contrato express (datos que recaudan información)
-- Permite corregir obrero / laboral tras ensamblar y regenerar el PDF.

alter table public.ci_contratos_express
  add column if not exists obrero_nombres text;

alter table public.ci_contratos_express
  add column if not exists obrero_apellidos text;

alter table public.ci_contratos_express
  add column if not exists fecha_ingreso date;

alter table public.ci_contratos_express
  add column if not exists estado_civil text;

alter table public.ci_contratos_express
  add column if not exists nacionalidad text;

alter table public.ci_contratos_express
  add column if not exists objeto_contrato text;

alter table public.ci_contratos_express
  add column if not exists jornada_trabajo text;

alter table public.ci_contratos_express
  add column if not exists obrero_municipio_residencia text;

alter table public.ci_contratos_express
  add column if not exists obrero_estado_residencia text;

comment on column public.ci_contratos_express.obrero_nombres is
  'Nombres del obrero (editables tras ensamblar el contrato).';
comment on column public.ci_contratos_express.obrero_apellidos is
  'Apellidos del obrero (editables tras ensamblar el contrato).';
comment on column public.ci_contratos_express.fecha_ingreso is
  'Fecha de ingreso / firma usada en el PDF del contrato express.';
comment on column public.ci_contratos_express.estado_civil is
  'Estado civil declarado en el contrato (default operativo: Soltero).';
comment on column public.ci_contratos_express.nacionalidad is
  'Nacionalidad en comparecencia (venezolano/venezolana o extranjero/a).';
comment on column public.ci_contratos_express.objeto_contrato is
  'Fase técnica / objeto (cláusula PRIMERA), si difiere del default de la obra.';
comment on column public.ci_contratos_express.jornada_trabajo is
  'Jornada (DIURNA / NOCTURNA / MIXTA) referencial.';
comment on column public.ci_contratos_express.obrero_municipio_residencia is
  'Municipio de residencia del trabajador (comparecencia).';
comment on column public.ci_contratos_express.obrero_estado_residencia is
  'Estado de residencia del trabajador (comparecencia).';

notify pgrst, 'reload schema';
