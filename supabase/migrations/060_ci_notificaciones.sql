-- Notificaciones por proyecto (módulo integral) + Realtime para feeds en dashboard.

create table if not exists public.ci_notificaciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  mensaje text not null,
  tipo text not null default 'general',
  empleado_id uuid references public.ci_empleados (id) on delete set null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_notificaciones_proyecto_created on public.ci_notificaciones (proyecto_id, created_at desc);

comment on table public.ci_notificaciones is
  'Avisos por proyecto; suscripción Realtime en cliente para feed en /proyectos/modulo/[id].';

comment on column public.ci_notificaciones.tipo is
  'talento: pestaña Gestión de Talento; empleado: ficha /empleados/[id] si empleado_id; general: pestaña talento.';

alter table public.ci_notificaciones enable row level security;

drop policy if exists "ci_notificaciones_select_anon" on public.ci_notificaciones;
drop policy if exists "ci_notificaciones_insert_anon" on public.ci_notificaciones;
drop policy if exists "ci_notificaciones_update_anon" on public.ci_notificaciones;
drop policy if exists "ci_notificaciones_delete_anon" on public.ci_notificaciones;
drop policy if exists "ci_notificaciones_select_auth" on public.ci_notificaciones;
drop policy if exists "ci_notificaciones_insert_auth" on public.ci_notificaciones;
drop policy if exists "ci_notificaciones_update_auth" on public.ci_notificaciones;
drop policy if exists "ci_notificaciones_delete_auth" on public.ci_notificaciones;

create policy "ci_notificaciones_select_anon" on public.ci_notificaciones for select to anon using (true);
create policy "ci_notificaciones_insert_anon" on public.ci_notificaciones for insert to anon with check (true);
create policy "ci_notificaciones_update_anon" on public.ci_notificaciones for update to anon using (true) with check (true);
create policy "ci_notificaciones_delete_anon" on public.ci_notificaciones for delete to anon using (true);
create policy "ci_notificaciones_select_auth" on public.ci_notificaciones for select to authenticated using (true);
create policy "ci_notificaciones_insert_auth" on public.ci_notificaciones for insert to authenticated with check (true);
create policy "ci_notificaciones_update_auth" on public.ci_notificaciones for update to authenticated using (true) with check (true);
create policy "ci_notificaciones_delete_auth" on public.ci_notificaciones for delete to authenticated using (true);

grant select, insert, update, delete on table public.ci_notificaciones to anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ci_notificaciones'
  ) then
    alter publication supabase_realtime add table public.ci_notificaciones;
  end if;
exception
  when undefined_object then
    raise notice 'Publicación supabase_realtime no encontrada; habilita Realtime para ci_notificaciones en el panel de Supabase.';
end $$;

notify pgrst, 'reload schema';
