-- Ejecutar en SQL Editor de Supabase (producción) si la migración 312 no se aplicó por CLI.
-- 312: Campos editables del contrato express

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

notify pgrst, 'reload schema';
