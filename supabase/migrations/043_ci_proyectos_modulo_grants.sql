-- Reparación: "permission denied for table ci_proyectos" (PostgREST / cliente anon o authenticated).
-- Causa habitual: tabla creada sin GRANT a anon/authenticated, o RLS activo sin políticas aplicadas.
-- Idempotente: GRANT es acumulativo; políticas con DROP IF EXISTS.

-- Privilegios mínimos para la API (clave anon / sesión authenticated) y service_role.
grant usage on schema public to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ci_proyectos',
    'ci_proyecto_equipos',
    'ci_proyecto_archivos',
    'ci_proyecto_visitas',
    'ci_proyecto_visita_archivos'
  ]
  loop
    if exists (
      select 1
      from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'grant select, insert, update, delete on table public.%I to anon, authenticated, service_role',
        t
      );
    end if;
  end loop;
end $$;

-- RLS + políticas (por si la tabla existía sin bloque 7 de la 037).
alter table public.ci_proyectos enable row level security;

drop policy if exists "ci_proyectos_select_anon" on public.ci_proyectos;
drop policy if exists "ci_proyectos_insert_anon" on public.ci_proyectos;
drop policy if exists "ci_proyectos_update_anon" on public.ci_proyectos;
drop policy if exists "ci_proyectos_delete_anon" on public.ci_proyectos;
drop policy if exists "ci_proyectos_select_auth" on public.ci_proyectos;
drop policy if exists "ci_proyectos_insert_auth" on public.ci_proyectos;
drop policy if exists "ci_proyectos_update_auth" on public.ci_proyectos;
drop policy if exists "ci_proyectos_delete_auth" on public.ci_proyectos;

create policy "ci_proyectos_select_anon" on public.ci_proyectos for select to anon using (true);
create policy "ci_proyectos_insert_anon" on public.ci_proyectos for insert to anon with check (true);
create policy "ci_proyectos_update_anon" on public.ci_proyectos for update to anon using (true) with check (true);
create policy "ci_proyectos_delete_anon" on public.ci_proyectos for delete to anon using (true);
create policy "ci_proyectos_select_auth" on public.ci_proyectos for select to authenticated using (true);
create policy "ci_proyectos_insert_auth" on public.ci_proyectos for insert to authenticated with check (true);
create policy "ci_proyectos_update_auth" on public.ci_proyectos for update to authenticated using (true) with check (true);
create policy "ci_proyectos_delete_auth" on public.ci_proyectos for delete to authenticated using (true);

notify pgrst, 'reload schema';
