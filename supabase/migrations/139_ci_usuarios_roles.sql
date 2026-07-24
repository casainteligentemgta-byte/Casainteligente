-- Asignación de rol por usuario (auth) y entidad (patrono).

create table if not exists public.ci_usuarios_roles (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  rol text not null,
  entidad_id uuid not null references public.ci_entidades (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_usuarios_roles_usuario_entidad_unique unique (usuario_id, entidad_id)
);

create index if not exists idx_ci_usuarios_roles_usuario on public.ci_usuarios_roles (usuario_id);
create index if not exists idx_ci_usuarios_roles_entidad on public.ci_usuarios_roles (entidad_id);
create index if not exists idx_ci_usuarios_roles_rol on public.ci_usuarios_roles (rol);

comment on table public.ci_usuarios_roles is
  'Rol de aplicación de un usuario (auth.users) dentro de una entidad/patrono.';
comment on column public.ci_usuarios_roles.usuario_id is 'UUID de auth.users.';
comment on column public.ci_usuarios_roles.rol is 'Rol funcional (texto libre: admin, rrhh, almacen, etc.).';

alter table public.ci_usuarios_roles enable row level security;

drop policy if exists "ci_usuarios_roles_select_auth" on public.ci_usuarios_roles;
drop policy if exists "ci_usuarios_roles_insert_auth" on public.ci_usuarios_roles;
drop policy if exists "ci_usuarios_roles_update_auth" on public.ci_usuarios_roles;
drop policy if exists "ci_usuarios_roles_delete_auth" on public.ci_usuarios_roles;

create policy "ci_usuarios_roles_select_auth" on public.ci_usuarios_roles
  for select to authenticated using (true);
create policy "ci_usuarios_roles_insert_auth" on public.ci_usuarios_roles
  for insert to authenticated with check (true);
create policy "ci_usuarios_roles_update_auth" on public.ci_usuarios_roles
  for update to authenticated using (true) with check (true);
create policy "ci_usuarios_roles_delete_auth" on public.ci_usuarios_roles
  for delete to authenticated using (true);
