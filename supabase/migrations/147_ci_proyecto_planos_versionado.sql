-- Metadatos de planos (código, versión, estatus, CAD + PDF) en ci_proyecto_archivos.

alter table public.ci_proyecto_archivos
  add column if not exists codigo_plano text,
  add column if not exists version_plano integer not null default 1,
  add column if not exists estatus_plano text not null default 'revision',
  add column if not exists cad_storage_bucket text,
  add column if not exists cad_storage_path text,
  add column if not exists cad_public_url text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ci_proyecto_archivos_estatus_plano_check'
  ) then
    alter table public.ci_proyecto_archivos
      add constraint ci_proyecto_archivos_estatus_plano_check
      check (estatus_plano in ('revision', 'aprobado_construccion', 'obsoleto'));
  end if;
end $$;

comment on column public.ci_proyecto_archivos.codigo_plano is 'Código de plano (ej. ARQ-01, EST-03).';
comment on column public.ci_proyecto_archivos.version_plano is 'Número de revisión del plano.';
comment on column public.ci_proyecto_archivos.estatus_plano is 'revision | aprobado_construccion | obsoleto';
comment on column public.ci_proyecto_archivos.public_url is 'URL del PDF para obra / visualización.';
comment on column public.ci_proyecto_archivos.cad_public_url is 'URL del archivo CAD (.dwg u otro).';

notify pgrst, 'reload schema';
