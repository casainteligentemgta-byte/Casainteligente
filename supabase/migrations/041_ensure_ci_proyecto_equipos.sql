-- Reparación: PostgREST "Could not find the table 'public.ci_proyecto_equipos' in the schema cache"
-- Causa habitual: migración 037 no aplicada en el proyecto remoto, o caché desactualizado tras crear tablas.
-- Esta migración es idempotente (IF NOT EXISTS + políticas con DROP previo).

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ci_proyectos'
  ) then
    raise exception
      'Falta public.ci_proyectos. Aplica antes supabase/migrations/037_ci_proyectos_modulo_integral.sql (o el historial completo de migraciones).';
  end if;
end $$;

create table if not exists public.ci_proyecto_equipos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos(id) on delete cascade,

  categoria text,
  nombre_equipo text not null,
  marca text,
  modelo text,
  serial text,
  cantidad numeric(14, 3) not null default 1,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ci_proyecto_equipos_cantidad_positiva check (cantidad > 0)
);

create index if not exists idx_ci_proyecto_equipos_proyecto on public.ci_proyecto_equipos (proyecto_id);
create index if not exists idx_ci_proyecto_equipos_serial on public.ci_proyecto_equipos (serial);

comment on table public.ci_proyecto_equipos is
  'Inventario de equipos por proyecto: marca, modelo, serial y cantidad.';

alter table public.ci_proyecto_equipos enable row level security;

drop policy if exists "ci_proyecto_equipos_select_anon" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_insert_anon" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_update_anon" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_delete_anon" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_select_auth" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_insert_auth" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_update_auth" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_delete_auth" on public.ci_proyecto_equipos;

create policy "ci_proyecto_equipos_select_anon" on public.ci_proyecto_equipos for select to anon using (true);
create policy "ci_proyecto_equipos_insert_anon" on public.ci_proyecto_equipos for insert to anon with check (true);
create policy "ci_proyecto_equipos_update_anon" on public.ci_proyecto_equipos for update to anon using (true) with check (true);
create policy "ci_proyecto_equipos_delete_anon" on public.ci_proyecto_equipos for delete to anon using (true);
create policy "ci_proyecto_equipos_select_auth" on public.ci_proyecto_equipos for select to authenticated using (true);
create policy "ci_proyecto_equipos_insert_auth" on public.ci_proyecto_equipos for insert to authenticated with check (true);
create policy "ci_proyecto_equipos_update_auth" on public.ci_proyecto_equipos for update to authenticated using (true) with check (true);
create policy "ci_proyecto_equipos_delete_auth" on public.ci_proyecto_equipos for delete to authenticated using (true);

-- Recarga del esquema en PostgREST (evita tabla "fantasma" en caché tras DDL).
notify pgrst, 'reload schema';
