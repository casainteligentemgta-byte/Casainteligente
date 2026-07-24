-- Nómina por proyecto: obreros y empleados con rol, email y Telegram.

create table if not exists public.ci_proyecto_nomina (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  empleado_id uuid references public.ci_empleados (id) on delete set null,
  categoria text not null check (categoria in ('obrero', 'empleado')),
  rol text not null,
  email text,
  telegram_chat_id bigint,
  telegram_telefono text,
  nombre text,
  cedula text,
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_proyecto_nomina_proyecto
  on public.ci_proyecto_nomina (proyecto_id, categoria, activo);

create index if not exists idx_ci_proyecto_nomina_empleado
  on public.ci_proyecto_nomina (empleado_id)
  where empleado_id is not null;

create unique index if not exists idx_ci_proyecto_nomina_proyecto_empleado
  on public.ci_proyecto_nomina (proyecto_id, empleado_id)
  where empleado_id is not null;

comment on table public.ci_proyecto_nomina is
  'Nómina operativa por proyecto: obreros y empleados con rol, correo y contacto Telegram.';
comment on column public.ci_proyecto_nomina.categoria is 'obrero = cuadrilla; empleado = personal administrativo/técnico en obra.';
comment on column public.ci_proyecto_nomina.rol is 'Rol funcional en el proyecto (depositario, oficial, ingeniero, etc.).';
comment on column public.ci_proyecto_nomina.telegram_telefono is 'Teléfono móvil asociado a Telegram (ej. 04141234567).';
comment on column public.ci_proyecto_nomina.nombre is 'Nombre visible si no hay empleado_id en RRHH.';

alter table public.ci_proyecto_nomina enable row level security;

drop policy if exists "ci_proyecto_nomina_select_anon" on public.ci_proyecto_nomina;
drop policy if exists "ci_proyecto_nomina_insert_anon" on public.ci_proyecto_nomina;
drop policy if exists "ci_proyecto_nomina_update_anon" on public.ci_proyecto_nomina;
drop policy if exists "ci_proyecto_nomina_delete_anon" on public.ci_proyecto_nomina;
drop policy if exists "ci_proyecto_nomina_select_auth" on public.ci_proyecto_nomina;
drop policy if exists "ci_proyecto_nomina_insert_auth" on public.ci_proyecto_nomina;
drop policy if exists "ci_proyecto_nomina_update_auth" on public.ci_proyecto_nomina;
drop policy if exists "ci_proyecto_nomina_delete_auth" on public.ci_proyecto_nomina;

create policy "ci_proyecto_nomina_select_anon" on public.ci_proyecto_nomina
  for select to anon using (true);
create policy "ci_proyecto_nomina_insert_anon" on public.ci_proyecto_nomina
  for insert to anon with check (true);
create policy "ci_proyecto_nomina_update_anon" on public.ci_proyecto_nomina
  for update to anon using (true) with check (true);
create policy "ci_proyecto_nomina_delete_anon" on public.ci_proyecto_nomina
  for delete to anon using (true);

create policy "ci_proyecto_nomina_select_auth" on public.ci_proyecto_nomina
  for select to authenticated using (true);
create policy "ci_proyecto_nomina_insert_auth" on public.ci_proyecto_nomina
  for insert to authenticated with check (true);
create policy "ci_proyecto_nomina_update_auth" on public.ci_proyecto_nomina
  for update to authenticated using (true) with check (true);
create policy "ci_proyecto_nomina_delete_auth" on public.ci_proyecto_nomina
  for delete to authenticated using (true);

notify pgrst, 'reload schema';
