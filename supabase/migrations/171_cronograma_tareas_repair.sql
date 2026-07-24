-- Repara cronograma_tareas si se creó sin columnas (CREATE IF NOT EXISTS falló parcial).

alter table public.cronograma_tareas
  add column if not exists codigo_partida text;

alter table public.cronograma_tareas
  add column if not exists orden integer not null default 0;

alter table public.cronograma_tareas
  add column if not exists notas text;

alter table public.cronograma_tareas
  add column if not exists updated_at timestamptz not null default now();

drop index if exists public.idx_cronograma_tareas_proyecto;

create index if not exists idx_cronograma_tareas_proyecto
  on public.cronograma_tareas (proyecto_id, orden, fecha_inicio_planificada);

notify pgrst, 'reload schema';
