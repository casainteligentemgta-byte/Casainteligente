-- Lapsos / tareas procesales por caso + campos judiciales opcionales.
-- Extiende ci_legal_casos sin reemplazar el modelo de expedientes existente.

alter table public.ci_legal_casos
  add column if not exists numero_expediente text,
  add column if not exists organo_tribunal text,
  add column if not exists fase_actual text,
  add column if not exists google_drive_folder_id text;

comment on column public.ci_legal_casos.numero_expediente is
  'Número de expediente judicial/administrativo (ej. Exp. N° AA40-A-2026-XXXX).';
comment on column public.ci_legal_casos.organo_tribunal is
  'Tribunal, fiscalía u órgano administrativo ante el que cursa el caso.';
comment on column public.ci_legal_casos.fase_actual is
  'Fase procesal actual (Preparatoria, Juicio, Ejecución, etc.).';
comment on column public.ci_legal_casos.google_drive_folder_id is
  'Referencia opcional a carpeta Drive (solo ID/enlace; sin sync automático).';

create table if not exists public.ci_legal_tareas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.ci_legal_orgs (id) on delete cascade,
  caso_id uuid not null references public.ci_legal_casos (id) on delete cascade,
  descripcion text not null,
  tipo_actuacion text,
  fecha_limite_lapso timestamptz not null,
  completada boolean not null default false,
  responsable_abogado text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_legal_tareas_caso
  on public.ci_legal_tareas (caso_id, fecha_limite_lapso);

create index if not exists idx_ci_legal_tareas_org_pendientes
  on public.ci_legal_tareas (org_id, completada, fecha_limite_lapso)
  where completada = false;

comment on table public.ci_legal_tareas is
  'Lapsos procesales y tareas críticas por caso (alertas de vencimiento).';

alter table public.ci_legal_tareas enable row level security;

drop policy if exists ci_legal_tareas_auth on public.ci_legal_tareas;
create policy ci_legal_tareas_auth
  on public.ci_legal_tareas for all to authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.ci_legal_tareas to authenticated, service_role;

notify pgrst, 'reload schema';
