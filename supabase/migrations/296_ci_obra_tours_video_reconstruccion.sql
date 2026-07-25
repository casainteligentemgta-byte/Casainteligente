-- Tours de obra: video (celular/dron) → reconstrucción 3D → tour DJI + modo piloto.
-- Worker GPU externo actualiza jobs; la app orquesta subida, preview y export.

create table if not exists public.ci_obra_tour_jobs (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  fuente_captura text not null
    check (fuente_captura in ('celular', 'dron')),
  calidad text not null default 'rapida'
    check (calidad in ('rapida', 'detallada')),
  estado text not null default 'pendiente'
    check (
      estado in (
        'pendiente',
        'subiendo',
        'encolado',
        'procesando',
        'modelo_listo',
        'renderizando_tour',
        'listo',
        'error',
        'cancelado'
      )
    ),
  progreso_pct numeric(5, 2) not null default 0
    check (progreso_pct >= 0 and progreso_pct <= 100),
  mensaje_estado text,
  error_codigo text,
  error_detalle text,
  video_storage_bucket text,
  video_storage_path text,
  video_public_url text,
  video_duracion_s numeric(10, 2),
  video_bytes bigint,
  modelo_formato text
    check (modelo_formato is null or modelo_formato in ('glb', 'gltf', 'splat', 'ply')),
  modelo_storage_bucket text,
  modelo_storage_path text,
  modelo_public_url text,
  worker_payload jsonb not null default '{}'::jsonb,
  worker_result jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ci_obra_tour_jobs is
  'Jobs de reconstrucción 3D desde video de obra (opción B: video → modelo → tour).';

comment on column public.ci_obra_tour_jobs.worker_payload is
  'Contrato hacia el worker GPU (URL firmada, calidad, callbacks, etc.).';

comment on column public.ci_obra_tour_jobs.worker_result is
  'Metadatos devueltos por el worker (bbox, frames usados, calidad estimada).';

create index if not exists idx_ci_obra_tour_jobs_proyecto_created
  on public.ci_obra_tour_jobs (proyecto_id, created_at desc);

create index if not exists idx_ci_obra_tour_jobs_estado
  on public.ci_obra_tour_jobs (estado)
  where estado not in ('listo', 'error', 'cancelado');

create table if not exists public.ci_obra_tours (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  job_id uuid references public.ci_obra_tour_jobs (id) on delete set null,
  nombre text not null default 'Tour de obra',
  modo text not null default 'automatico'
    check (modo in ('automatico', 'piloto')),
  estado text not null default 'borrador'
    check (estado in ('borrador', 'generando', 'listo', 'error')),
  camera_path jsonb not null default '[]'::jsonb,
  export_formato text
    check (
      export_formato is null
      or export_formato in ('mp4_h264', 'mp4_h265', 'mov_h264', 'mov_h265')
    ),
  export_layout text
    check (
      export_layout is null
      or export_layout in ('2d', 'hsbs', 'fsbs', 'hou', 'fou', 'panorama_2d')
    ),
  export_storage_bucket text,
  export_storage_path text,
  export_public_url text,
  export_duracion_s numeric(10, 2),
  dji_ready boolean not null default false,
  notas text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ci_obra_tours is
  'Tours generados por obra: automático (MP4 DJI) o piloto (joystick en web).';

comment on column public.ci_obra_tours.camera_path is
  'Waypoints de cámara [{t,x,y,z,yaw,pitch,fov}, ...] para tour automático.';

comment on column public.ci_obra_tours.export_layout is
  'Layout de video para DJI Goggles: 2d | hsbs | fsbs | hou | fou | panorama_2d.';

create index if not exists idx_ci_obra_tours_proyecto_created
  on public.ci_obra_tours (proyecto_id, created_at desc);

create index if not exists idx_ci_obra_tours_job
  on public.ci_obra_tours (job_id)
  where job_id is not null;

create or replace function public.ci_obra_tours_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ci_obra_tour_jobs_updated_at on public.ci_obra_tour_jobs;
create trigger trg_ci_obra_tour_jobs_updated_at
  before update on public.ci_obra_tour_jobs
  for each row
  execute function public.ci_obra_tours_set_updated_at();

drop trigger if exists trg_ci_obra_tours_updated_at on public.ci_obra_tours;
create trigger trg_ci_obra_tours_updated_at
  before update on public.ci_obra_tours
  for each row
  execute function public.ci_obra_tours_set_updated_at();

alter table public.ci_obra_tour_jobs enable row level security;
alter table public.ci_obra_tours enable row level security;

drop policy if exists "ci_obra_tour_jobs_select_anon" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_insert_anon" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_update_anon" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_delete_anon" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_select_auth" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_insert_auth" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_update_auth" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_delete_auth" on public.ci_obra_tour_jobs;

create policy "ci_obra_tour_jobs_select_anon" on public.ci_obra_tour_jobs
  for select to anon using (true);
create policy "ci_obra_tour_jobs_insert_anon" on public.ci_obra_tour_jobs
  for insert to anon with check (true);
create policy "ci_obra_tour_jobs_update_anon" on public.ci_obra_tour_jobs
  for update to anon using (true) with check (true);
create policy "ci_obra_tour_jobs_delete_anon" on public.ci_obra_tour_jobs
  for delete to anon using (true);

create policy "ci_obra_tour_jobs_select_auth" on public.ci_obra_tour_jobs
  for select to authenticated using (true);
create policy "ci_obra_tour_jobs_insert_auth" on public.ci_obra_tour_jobs
  for insert to authenticated with check (true);
create policy "ci_obra_tour_jobs_update_auth" on public.ci_obra_tour_jobs
  for update to authenticated using (true) with check (true);
create policy "ci_obra_tour_jobs_delete_auth" on public.ci_obra_tour_jobs
  for delete to authenticated using (true);

drop policy if exists "ci_obra_tours_select_anon" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_insert_anon" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_update_anon" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_delete_anon" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_select_auth" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_insert_auth" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_update_auth" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_delete_auth" on public.ci_obra_tours;

create policy "ci_obra_tours_select_anon" on public.ci_obra_tours
  for select to anon using (true);
create policy "ci_obra_tours_insert_anon" on public.ci_obra_tours
  for insert to anon with check (true);
create policy "ci_obra_tours_update_anon" on public.ci_obra_tours
  for update to anon using (true) with check (true);
create policy "ci_obra_tours_delete_anon" on public.ci_obra_tours
  for delete to anon using (true);

create policy "ci_obra_tours_select_auth" on public.ci_obra_tours
  for select to authenticated using (true);
create policy "ci_obra_tours_insert_auth" on public.ci_obra_tours
  for insert to authenticated with check (true);
create policy "ci_obra_tours_update_auth" on public.ci_obra_tours
  for update to authenticated using (true) with check (true);
create policy "ci_obra_tours_delete_auth" on public.ci_obra_tours
  for delete to authenticated using (true);

grant select, insert, update, delete on table public.ci_obra_tour_jobs
  to anon, authenticated, service_role;
grant select, insert, update, delete on table public.ci_obra_tours
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
