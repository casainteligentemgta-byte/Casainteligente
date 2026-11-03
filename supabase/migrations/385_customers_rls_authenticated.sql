-- Codifica el RLS real de customers (producción ya tenía customers_auth_*):
-- solo quien tiene sesión; se quitan las políticas anon de la 009 y el GRANT a anon.
-- No se aplica sola en producción.

alter table public.customers enable row level security;

drop policy if exists "Permitir leer customers" on public.customers;
drop policy if exists "Permitir insertar customers" on public.customers;
drop policy if exists "Permitir actualizar customers" on public.customers;
drop policy if exists "Permitir borrar customers" on public.customers;

drop policy if exists customers_auth_select on public.customers;
drop policy if exists customers_auth_insert on public.customers;
drop policy if exists customers_auth_update on public.customers;
drop policy if exists customers_auth_delete on public.customers;

create policy customers_auth_select
  on public.customers for select to authenticated using (true);
create policy customers_auth_insert
  on public.customers for insert to authenticated with check (true);
create policy customers_auth_update
  on public.customers for update to authenticated using (true) with check (true);
create policy customers_auth_delete
  on public.customers for delete to authenticated using (true);

revoke all on table public.customers from anon;
grant select, insert, update, delete on table public.customers to authenticated;

-- Matriz de roles (si 376 ya corrió): mismos slugs que lib/auth/permisosCatalogo.ts.
do $$
begin
  if to_regclass('public.ci_rol_permisos') is null then
    return;
  end if;
  insert into public.ci_rol_permisos (rol, permiso)
  values
    ('super_admin', 'clientes.ver'),
    ('super_admin', 'clientes.editar'),
    ('super_admin', 'clientes.borrar'),
    ('entidad_admin', 'clientes.ver'),
    ('entidad_admin', 'clientes.editar'),
    ('entidad_admin', 'clientes.borrar'),
    ('director', 'clientes.ver'),
    ('director', 'clientes.editar'),
    ('director', 'clientes.borrar'),
    ('pm_obra', 'clientes.ver'),
    ('pm_obra', 'clientes.editar'),
    ('pm_obra', 'clientes.borrar')
  on conflict do nothing;
end $$;
