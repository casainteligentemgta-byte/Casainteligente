-- Solicitudes de mano de obra (director) y asignaciones a obreros (ci_empleados).
-- Integrado con ci_proyectos y ci_empleados existentes.

create table if not exists public.labor_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ci_proyectos (id) on delete cascade,
  specialty_codigo text not null,
  specialty_nombre text,
  quantity_requested int not null default 1,
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint labor_requests_qty check (quantity_requested >= 1 and quantity_requested <= 500)
);

create index if not exists idx_labor_requests_project on public.labor_requests (project_id);
create index if not exists idx_labor_requests_status on public.labor_requests (status);
create index if not exists idx_labor_requests_created on public.labor_requests (created_at desc);

comment on table public.labor_requests is
  'Solicitud de personal por proyecto y especialidad (tabulador GOE). RRHH asigna obreros desde ci_empleados.';

create table if not exists public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  labor_request_id uuid not null references public.labor_requests (id) on delete cascade,
  worker_id uuid not null references public.ci_empleados (id) on delete restrict,
  project_id uuid not null references public.ci_proyectos (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (labor_request_id, worker_id)
);

create index if not exists idx_project_assignments_request on public.project_assignments (labor_request_id);
create index if not exists idx_project_assignments_project on public.project_assignments (project_id);
create index if not exists idx_project_assignments_worker on public.project_assignments (worker_id);

comment on table public.project_assignments is
  'Asignación de un obrero (ci_empleados) a una solicitud y proyecto de obra.';

alter table public.labor_requests enable row level security;
alter table public.project_assignments enable row level security;

drop policy if exists "labor_requests_select_anon" on public.labor_requests;
drop policy if exists "labor_requests_insert_anon" on public.labor_requests;
drop policy if exists "labor_requests_update_anon" on public.labor_requests;
drop policy if exists "labor_requests_delete_anon" on public.labor_requests;
drop policy if exists "labor_requests_select_auth" on public.labor_requests;
drop policy if exists "labor_requests_insert_auth" on public.labor_requests;
drop policy if exists "labor_requests_update_auth" on public.labor_requests;
drop policy if exists "labor_requests_delete_auth" on public.labor_requests;

create policy "labor_requests_select_anon" on public.labor_requests for select to anon using (true);
create policy "labor_requests_insert_anon" on public.labor_requests for insert to anon with check (true);
create policy "labor_requests_update_anon" on public.labor_requests for update to anon using (true) with check (true);
create policy "labor_requests_delete_anon" on public.labor_requests for delete to anon using (true);
create policy "labor_requests_select_auth" on public.labor_requests for select to authenticated using (true);
create policy "labor_requests_insert_auth" on public.labor_requests for insert to authenticated with check (true);
create policy "labor_requests_update_auth" on public.labor_requests for update to authenticated using (true) with check (true);
create policy "labor_requests_delete_auth" on public.labor_requests for delete to authenticated using (true);

drop policy if exists "project_assignments_select_anon" on public.project_assignments;
drop policy if exists "project_assignments_insert_anon" on public.project_assignments;
drop policy if exists "project_assignments_update_anon" on public.project_assignments;
drop policy if exists "project_assignments_delete_anon" on public.project_assignments;
drop policy if exists "project_assignments_select_auth" on public.project_assignments;
drop policy if exists "project_assignments_insert_auth" on public.project_assignments;
drop policy if exists "project_assignments_update_auth" on public.project_assignments;
drop policy if exists "project_assignments_delete_auth" on public.project_assignments;

create policy "project_assignments_select_anon" on public.project_assignments for select to anon using (true);
create policy "project_assignments_insert_anon" on public.project_assignments for insert to anon with check (true);
create policy "project_assignments_update_anon" on public.project_assignments for update to anon using (true) with check (true);
create policy "project_assignments_delete_anon" on public.project_assignments for delete to anon using (true);
create policy "project_assignments_select_auth" on public.project_assignments for select to authenticated using (true);
create policy "project_assignments_insert_auth" on public.project_assignments for insert to authenticated with check (true);
create policy "project_assignments_update_auth" on public.project_assignments for update to authenticated using (true) with check (true);
create policy "project_assignments_delete_auth" on public.project_assignments for delete to authenticated using (true);

grant select, insert, update, delete on public.labor_requests to anon, authenticated, service_role;
grant select, insert, update, delete on public.project_assignments to anon, authenticated, service_role;

notify pgrst, 'reload schema';
