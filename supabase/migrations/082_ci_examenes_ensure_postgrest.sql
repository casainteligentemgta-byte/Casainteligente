-- Reparación: PostgREST PGRST205 "Could not find the table 'public.ci_examenes' in the schema cache"
-- (tabla nunca creada en remoto, o migraciones 029–030 no aplicadas).
-- Idempotente: IF NOT EXISTS + políticas con DROP IF EXISTS.

create table if not exists public.ci_examenes (
  id uuid primary key default gen_random_uuid() not null,
  empleado_id uuid not null references public.ci_empleados (id) on delete cascade,
  token text not null,
  expira_at timestamptz not null,
  usado_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_ci_examenes_token on public.ci_examenes (token);
create index if not exists idx_ci_examenes_empleado on public.ci_examenes (empleado_id);

alter table public.ci_examenes
  add column if not exists fin_at timestamptz;

alter table public.ci_examenes
  add column if not exists respuestas_json jsonb;

alter table public.ci_examenes
  add column if not exists completado boolean not null default false;

comment on column public.ci_examenes.completado is
  'true si se registró cierre (p. ej. tiempo agotado) vía /api/talento/examen/finalizar.';
comment on column public.ci_examenes.respuestas_json is
  'Snapshot de respuestas al cierre (parcial o según negocio).';

alter table public.ci_examenes enable row level security;

drop policy if exists "ci_examenes_select_anon" on public.ci_examenes;
drop policy if exists "ci_examenes_insert_anon" on public.ci_examenes;
drop policy if exists "ci_examenes_update_anon" on public.ci_examenes;
drop policy if exists "ci_examenes_delete_anon" on public.ci_examenes;
drop policy if exists "ci_examenes_select_auth" on public.ci_examenes;
drop policy if exists "ci_examenes_insert_auth" on public.ci_examenes;
drop policy if exists "ci_examenes_update_auth" on public.ci_examenes;
drop policy if exists "ci_examenes_delete_auth" on public.ci_examenes;

create policy "ci_examenes_select_anon" on public.ci_examenes for select to anon using (true);
create policy "ci_examenes_insert_anon" on public.ci_examenes for insert to anon with check (true);
create policy "ci_examenes_update_anon" on public.ci_examenes for update to anon using (true) with check (true);
create policy "ci_examenes_delete_anon" on public.ci_examenes for delete to anon using (true);

create policy "ci_examenes_select_auth" on public.ci_examenes for select to authenticated using (true);
create policy "ci_examenes_insert_auth" on public.ci_examenes for insert to authenticated with check (true);
create policy "ci_examenes_update_auth" on public.ci_examenes for update to authenticated using (true) with check (true);
create policy "ci_examenes_delete_auth" on public.ci_examenes for delete to authenticated using (true);

grant select, insert, update, delete on table public.ci_examenes to anon, authenticated, service_role;

notify pgrst, 'reload schema';
