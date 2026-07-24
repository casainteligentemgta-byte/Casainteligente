-- Biblioteca de plantillas de documentos (contrato obrero, etc.). Editable desde la app (API con service role).

create table if not exists public.ci_documento_plantillas (
  id uuid primary key default gen_random_uuid() not null,
  codigo text not null unique,
  titulo text not null,
  descripcion text,
  cuerpo text not null,
  version smallint not null default 1,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_documento_plantillas_activo on public.ci_documento_plantillas (activo) where activo = true;

comment on table public.ci_documento_plantillas is
  'Plantillas legales con marcadores {{VARIABLE}}; sustitución en servidor al generar PDF/contrato.';
comment on column public.ci_documento_plantillas.codigo is
  'Identificador estable, p. ej. contrato_obrero.';
comment on column public.ci_documento_plantillas.cuerpo is
  'Texto del documento; use marcadores {{EMPLEADO_NOMBRE_COMPLETO}}, {{OBRA_NOMBRE}}, etc.';

alter table public.ci_documento_plantillas enable row level security;

drop policy if exists "ci_doc_plant_select_auth" on public.ci_documento_plantillas;
drop policy if exists "ci_doc_plant_all_service" on public.ci_documento_plantillas;

create policy "ci_doc_plant_select_auth" on public.ci_documento_plantillas
  for select to authenticated using (true);

create policy "ci_doc_plant_all_service" on public.ci_documento_plantillas
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
