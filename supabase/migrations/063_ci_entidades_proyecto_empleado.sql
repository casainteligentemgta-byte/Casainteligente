-- Entidades de trabajo (razón social + RIF), vínculo a proyectos módulo integral y a candidatos (planilla de empleo).

create table if not exists public.ci_entidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rif text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_entidades_nombre on public.ci_entidades (nombre);

comment on table public.ci_entidades is
  'Entidad de trabajo (patrono): razón social y RIF para expedientes, contratos y planillas.';
comment on column public.ci_entidades.rif is
  'RIF venezolano u otro identificador fiscal (texto libre).';

alter table public.ci_proyectos
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

create index if not exists idx_ci_proyectos_entidad on public.ci_proyectos (entidad_id);

comment on column public.ci_proyectos.entidad_id is
  'Patrono / entidad legal asociada al proyecto (planilla de empleo).';

alter table public.ci_empleados
  add column if not exists proyecto_modulo_id uuid references public.ci_proyectos (id) on delete set null;

create index if not exists idx_ci_empleados_proyecto_modulo on public.ci_empleados (proyecto_modulo_id);

comment on column public.ci_empleados.proyecto_modulo_id is
  'Proyecto (ci_proyectos) para rellenar entidad/RIF/proyecto en planilla de empleo y PDF.';

-- RLS (mismo patrón que ci_proyectos)
alter table public.ci_entidades enable row level security;

drop policy if exists "ci_entidades_select_anon" on public.ci_entidades;
drop policy if exists "ci_entidades_insert_anon" on public.ci_entidades;
drop policy if exists "ci_entidades_update_anon" on public.ci_entidades;
drop policy if exists "ci_entidades_delete_anon" on public.ci_entidades;
drop policy if exists "ci_entidades_select_auth" on public.ci_entidades;
drop policy if exists "ci_entidades_insert_auth" on public.ci_entidades;
drop policy if exists "ci_entidades_update_auth" on public.ci_entidades;
drop policy if exists "ci_entidades_delete_auth" on public.ci_entidades;

create policy "ci_entidades_select_anon" on public.ci_entidades for select to anon using (true);
create policy "ci_entidades_insert_anon" on public.ci_entidades for insert to anon with check (true);
create policy "ci_entidades_update_anon" on public.ci_entidades for update to anon using (true) with check (true);
create policy "ci_entidades_delete_anon" on public.ci_entidades for delete to anon using (true);
create policy "ci_entidades_select_auth" on public.ci_entidades for select to authenticated using (true);
create policy "ci_entidades_insert_auth" on public.ci_entidades for insert to authenticated with check (true);
create policy "ci_entidades_update_auth" on public.ci_entidades for update to authenticated using (true);
create policy "ci_entidades_delete_auth" on public.ci_entidades for delete to authenticated using (true);
