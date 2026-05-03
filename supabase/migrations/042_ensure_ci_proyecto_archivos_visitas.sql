-- Reparación: PostgREST "Could not find the table 'public.ci_proyecto_archivos' in the schema cache"
-- (y la misma clase de error para visitas / archivos de visita si faltaban).
-- Idempotente: IF NOT EXISTS + DROP POLICY IF EXISTS. Requiere public.ci_proyectos.

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ci_proyectos'
  ) then
    raise exception
      'Falta public.ci_proyectos. Aplica 037_ci_proyectos_modulo_integral.sql o crea el proyecto base primero.';
  end if;
end $$;

-- --- ci_proyecto_archivos ---
create table if not exists public.ci_proyecto_archivos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos(id) on delete cascade,

  tipo text not null
    check (tipo in ('foto_proyecto', 'plano', 'documento', 'otro')),
  titulo text,
  descripcion text,

  storage_bucket text,
  storage_path text,
  public_url text,
  mime_type text,

  created_at timestamptz not null default now()
);

create index if not exists idx_ci_proyecto_archivos_proyecto on public.ci_proyecto_archivos (proyecto_id);
create index if not exists idx_ci_proyecto_archivos_tipo on public.ci_proyecto_archivos (tipo);

comment on table public.ci_proyecto_archivos is
  'Archivos del proyecto: fotos y planos (rutas de Storage y/o URL publica).';

alter table public.ci_proyecto_archivos enable row level security;

drop policy if exists "ci_proyecto_archivos_select_anon" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_insert_anon" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_update_anon" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_delete_anon" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_select_auth" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_insert_auth" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_update_auth" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_delete_auth" on public.ci_proyecto_archivos;

create policy "ci_proyecto_archivos_select_anon" on public.ci_proyecto_archivos for select to anon using (true);
create policy "ci_proyecto_archivos_insert_anon" on public.ci_proyecto_archivos for insert to anon with check (true);
create policy "ci_proyecto_archivos_update_anon" on public.ci_proyecto_archivos for update to anon using (true) with check (true);
create policy "ci_proyecto_archivos_delete_anon" on public.ci_proyecto_archivos for delete to anon using (true);
create policy "ci_proyecto_archivos_select_auth" on public.ci_proyecto_archivos for select to authenticated using (true);
create policy "ci_proyecto_archivos_insert_auth" on public.ci_proyecto_archivos for insert to authenticated with check (true);
create policy "ci_proyecto_archivos_update_auth" on public.ci_proyecto_archivos for update to authenticated using (true) with check (true);
create policy "ci_proyecto_archivos_delete_auth" on public.ci_proyecto_archivos for delete to authenticated using (true);

-- --- ci_proyecto_visitas ---
create table if not exists public.ci_proyecto_visitas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos(id) on delete cascade,

  tecnico_nombre text not null,
  tecnico_usuario_id uuid,

  fecha_hora_visita timestamptz not null default now(),
  foto_antes_storage_bucket text,
  foto_antes_storage_path text,
  foto_antes_public_url text,

  informe_breve text not null,
  recomendaciones text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_proyecto_visitas_proyecto on public.ci_proyecto_visitas (proyecto_id);
create index if not exists idx_ci_proyecto_visitas_fecha on public.ci_proyecto_visitas (fecha_hora_visita desc);

comment on table public.ci_proyecto_visitas is
  'Bitacora de visitas de inspeccion: evidencia previa, fecha/hora e informe tecnico.';

alter table public.ci_proyecto_visitas enable row level security;

drop policy if exists "ci_proyecto_visitas_select_anon" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_insert_anon" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_update_anon" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_delete_anon" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_select_auth" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_insert_auth" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_update_auth" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_delete_auth" on public.ci_proyecto_visitas;

create policy "ci_proyecto_visitas_select_anon" on public.ci_proyecto_visitas for select to anon using (true);
create policy "ci_proyecto_visitas_insert_anon" on public.ci_proyecto_visitas for insert to anon with check (true);
create policy "ci_proyecto_visitas_update_anon" on public.ci_proyecto_visitas for update to anon using (true) with check (true);
create policy "ci_proyecto_visitas_delete_anon" on public.ci_proyecto_visitas for delete to anon using (true);
create policy "ci_proyecto_visitas_select_auth" on public.ci_proyecto_visitas for select to authenticated using (true);
create policy "ci_proyecto_visitas_insert_auth" on public.ci_proyecto_visitas for insert to authenticated with check (true);
create policy "ci_proyecto_visitas_update_auth" on public.ci_proyecto_visitas for update to authenticated using (true) with check (true);
create policy "ci_proyecto_visitas_delete_auth" on public.ci_proyecto_visitas for delete to authenticated using (true);

-- --- ci_proyecto_visita_archivos (depende de ci_proyecto_visitas) ---
create table if not exists public.ci_proyecto_visita_archivos (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references public.ci_proyecto_visitas(id) on delete cascade,

  tipo text not null
    check (tipo in ('foto_antes', 'foto_durante', 'foto_despues', 'documento', 'otro')),
  titulo text,
  storage_bucket text,
  storage_path text,
  public_url text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_proyecto_visita_archivos_visita on public.ci_proyecto_visita_archivos (visita_id);
create index if not exists idx_ci_proyecto_visita_archivos_tipo on public.ci_proyecto_visita_archivos (tipo);

comment on table public.ci_proyecto_visita_archivos is
  'Archivos anexos de cada visita tecnica.';

alter table public.ci_proyecto_visita_archivos enable row level security;

drop policy if exists "ci_proyecto_visita_archivos_select_anon" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_insert_anon" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_update_anon" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_delete_anon" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_select_auth" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_insert_auth" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_update_auth" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_delete_auth" on public.ci_proyecto_visita_archivos;

create policy "ci_proyecto_visita_archivos_select_anon" on public.ci_proyecto_visita_archivos for select to anon using (true);
create policy "ci_proyecto_visita_archivos_insert_anon" on public.ci_proyecto_visita_archivos for insert to anon with check (true);
create policy "ci_proyecto_visita_archivos_update_anon" on public.ci_proyecto_visita_archivos for update to anon using (true) with check (true);
create policy "ci_proyecto_visita_archivos_delete_anon" on public.ci_proyecto_visita_archivos for delete to anon using (true);
create policy "ci_proyecto_visita_archivos_select_auth" on public.ci_proyecto_visita_archivos for select to authenticated using (true);
create policy "ci_proyecto_visita_archivos_insert_auth" on public.ci_proyecto_visita_archivos for insert to authenticated with check (true);
create policy "ci_proyecto_visita_archivos_update_auth" on public.ci_proyecto_visita_archivos for update to authenticated using (true) with check (true);
create policy "ci_proyecto_visita_archivos_delete_auth" on public.ci_proyecto_visita_archivos for delete to authenticated using (true);

notify pgrst, 'reload schema';
