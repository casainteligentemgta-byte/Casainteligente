-- Repara recursión infinita en políticas RLS de public.ci_usuarios_roles.
-- Causa típica: políticas que hacen EXISTS sobre la misma tabla.
-- Solución: helper SECURITY DEFINER (bypass RLS) + políticas no recursivas.

create or replace function public.ci_usuarios_roles_soy_gestor()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tiene_user_id boolean;
  tiene_usuario_id boolean;
begin
  if uid is null then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ci_usuarios_roles'
      and column_name = 'user_id'
  ) into tiene_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ci_usuarios_roles'
      and column_name = 'usuario_id'
  ) into tiene_usuario_id;

  if tiene_user_id then
    return exists (
      select 1
      from public.ci_usuarios_roles ur
      where ur.user_id = uid
        and lower(ur.rol::text) in (
          'admin', 'administrador', 'super_admin', 'pm_obra', 'rrhh', 'proyectos', 'project_manager'
        )
    );
  end if;

  if tiene_usuario_id then
    return exists (
      select 1
      from public.ci_usuarios_roles ur
      where ur.usuario_id = uid
        and lower(ur.rol::text) in (
          'admin', 'administrador', 'super_admin', 'pm_obra', 'rrhh', 'proyectos', 'project_manager'
        )
    );
  end if;

  return false;
end;
$$;

revoke all on function public.ci_usuarios_roles_soy_gestor() from public;
grant execute on function public.ci_usuarios_roles_soy_gestor() to authenticated;
grant execute on function public.ci_usuarios_roles_soy_gestor() to service_role;

comment on function public.ci_usuarios_roles_soy_gestor() is
  'SECURITY DEFINER: indica si auth.uid() puede gestionar equipo. Evita recursión RLS en ci_usuarios_roles.';

do $$
declare
  pol record;
  tiene_user_id boolean;
  tiene_usuario_id boolean;
begin
  if to_regclass('public.ci_usuarios_roles') is null then
    raise notice 'ci_usuarios_roles no existe; se omite repair RLS';
    return;
  end if;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ci_usuarios_roles'
  loop
    execute format('drop policy if exists %I on public.ci_usuarios_roles', pol.policyname);
  end loop;

  alter table public.ci_usuarios_roles enable row level security;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ci_usuarios_roles'
      and column_name = 'user_id'
  ) into tiene_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ci_usuarios_roles'
      and column_name = 'usuario_id'
  ) into tiene_usuario_id;

  if tiene_user_id then
    execute $p$
      create policy "ci_usuarios_roles_select_own_or_gestor"
        on public.ci_usuarios_roles
        for select to authenticated
        using (user_id = auth.uid() or public.ci_usuarios_roles_soy_gestor())
    $p$;
    execute $p$
      create policy "ci_usuarios_roles_insert_gestor"
        on public.ci_usuarios_roles
        for insert to authenticated
        with check (public.ci_usuarios_roles_soy_gestor())
    $p$;
    execute $p$
      create policy "ci_usuarios_roles_update_gestor"
        on public.ci_usuarios_roles
        for update to authenticated
        using (public.ci_usuarios_roles_soy_gestor())
        with check (public.ci_usuarios_roles_soy_gestor())
    $p$;
    execute $p$
      create policy "ci_usuarios_roles_delete_gestor"
        on public.ci_usuarios_roles
        for delete to authenticated
        using (public.ci_usuarios_roles_soy_gestor())
    $p$;
  elsif tiene_usuario_id then
    execute $p$
      create policy "ci_usuarios_roles_select_own_or_gestor"
        on public.ci_usuarios_roles
        for select to authenticated
        using (usuario_id = auth.uid() or public.ci_usuarios_roles_soy_gestor())
    $p$;
    execute $p$
      create policy "ci_usuarios_roles_insert_gestor"
        on public.ci_usuarios_roles
        for insert to authenticated
        with check (public.ci_usuarios_roles_soy_gestor())
    $p$;
    execute $p$
      create policy "ci_usuarios_roles_update_gestor"
        on public.ci_usuarios_roles
        for update to authenticated
        using (public.ci_usuarios_roles_soy_gestor())
        with check (public.ci_usuarios_roles_soy_gestor())
    $p$;
    execute $p$
      create policy "ci_usuarios_roles_delete_gestor"
        on public.ci_usuarios_roles
        for delete to authenticated
        using (public.ci_usuarios_roles_soy_gestor())
    $p$;
  else
    -- Fallback permisivo si el esquema es inesperado (evita bloquear la app).
    execute $p$
      create policy "ci_usuarios_roles_select_auth"
        on public.ci_usuarios_roles
        for select to authenticated
        using (true)
    $p$;
  end if;
end;
$$;

notify pgrst, 'reload schema';
