-- Pipeline operativo de reclutamiento: candidatos (`persons`) y asignaciones a solicitudes sin ser aún `ci_empleados`.
-- Requiere migración 104 (labor_requests, project_assignments) y tablas referenciadas.

-- ─── persons ─────────────────────────────────────────────────────────────
create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  is_candidate boolean not null default true,
  pipeline_stage text not null default 'postulado'
    check (pipeline_stage in ('postulado', 'entrevistado', 'aprobado')),
  cv_data jsonb not null default '{}'::jsonb,
  specialty_codigo text,
  specialty_nombre text,
  salary_expectation numeric(14, 2),
  suggested_labor_request_id uuid references public.labor_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_persons_candidate on public.persons (is_candidate) where is_candidate = true;
create index if not exists idx_persons_pipeline on public.persons (pipeline_stage);
create index if not exists idx_persons_specialty on public.persons (specialty_codigo);

comment on table public.persons is
  'Candidatos de reclutamiento operativo; is_candidate=false al vincular a labor_requests via project_assignments.person_id.';

-- ─── labor_requests: estado en curso ─────────────────────────────────────
alter table public.labor_requests drop constraint if exists labor_requests_status_check;
alter table public.labor_requests
  add constraint labor_requests_status_check check (
    status in ('pending', 'in_progress', 'fulfilled', 'cancelled')
  );

-- ─── project_assignments: filas solo-candidato (person_id) ───────────────
alter table public.project_assignments alter column worker_id drop not null;

alter table public.project_assignments
  add column if not exists person_id uuid references public.persons (id) on delete cascade;

alter table public.project_assignments drop constraint if exists project_assignments_labor_request_id_worker_id_key;

alter table public.project_assignments
  add constraint project_assignments_worker_or_person check (
    (worker_id is not null and person_id is null) or (worker_id is null and person_id is not null)
  );

create unique index if not exists uq_project_assignments_lr_worker
  on public.project_assignments (labor_request_id, worker_id)
  where worker_id is not null;

create unique index if not exists uq_project_assignments_lr_person
  on public.project_assignments (labor_request_id, person_id)
  where person_id is not null;

comment on column public.project_assignments.person_id is
  'Candidato (persons) asignado a la solicitud; excluyente con worker_id (ci_empleados).';

-- ─── RLS persons ─────────────────────────────────────────────────────────
alter table public.persons enable row level security;

drop policy if exists "persons_select_anon" on public.persons;
drop policy if exists "persons_insert_anon" on public.persons;
drop policy if exists "persons_update_anon" on public.persons;
drop policy if exists "persons_delete_anon" on public.persons;
drop policy if exists "persons_select_auth" on public.persons;
drop policy if exists "persons_insert_auth" on public.persons;
drop policy if exists "persons_update_auth" on public.persons;
drop policy if exists "persons_delete_auth" on public.persons;

create policy "persons_select_anon" on public.persons for select to anon using (true);
create policy "persons_insert_anon" on public.persons for insert to anon with check (true);
create policy "persons_update_anon" on public.persons for update to anon using (true) with check (true);
create policy "persons_delete_anon" on public.persons for delete to anon using (true);
create policy "persons_select_auth" on public.persons for select to authenticated using (true);
create policy "persons_insert_auth" on public.persons for insert to authenticated with check (true);
create policy "persons_update_auth" on public.persons for update to authenticated using (true) with check (true);
create policy "persons_delete_auth" on public.persons for delete to authenticated using (true);

grant select, insert, update, delete on public.persons to anon, authenticated, service_role;

notify pgrst, 'reload schema';
