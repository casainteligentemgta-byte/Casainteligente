-- Cronograma de actividades por obra (diagrama de Gantt).

create table if not exists public.cronograma_tareas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  partida_id uuid references public.ci_presupuesto_partidas (id) on delete set null,
  codigo_partida text,
  nombre_tarea text not null,
  fecha_inicio_planificada date not null,
  fecha_fin_planificada date not null,
  porcentaje_avance numeric(5, 2) not null default 0
    check (porcentaje_avance >= 0 and porcentaje_avance <= 100),
  orden integer not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cronograma_tareas_fechas_check
    check (fecha_fin_planificada >= fecha_inicio_planificada)
);

create index if not exists idx_cronograma_tareas_proyecto
  on public.cronograma_tareas (proyecto_id, orden, fecha_inicio_planificada);

create index if not exists idx_cronograma_tareas_partida
  on public.cronograma_tareas (partida_id)
  where partida_id is not null;

comment on table public.cronograma_tareas is
  'Actividades planificadas de obra para cronograma Gantt (vinculadas a partidas Lulo).';

alter table public.cronograma_tareas enable row level security;

drop policy if exists "cronograma_tareas_select_anon" on public.cronograma_tareas;
drop policy if exists "cronograma_tareas_insert_anon" on public.cronograma_tareas;
drop policy if exists "cronograma_tareas_update_anon" on public.cronograma_tareas;
drop policy if exists "cronograma_tareas_delete_anon" on public.cronograma_tareas;

create policy "cronograma_tareas_select_anon"
  on public.cronograma_tareas for select to anon using (true);
create policy "cronograma_tareas_insert_anon"
  on public.cronograma_tareas for insert to anon with check (true);
create policy "cronograma_tareas_update_anon"
  on public.cronograma_tareas for update to anon using (true) with check (true);
create policy "cronograma_tareas_delete_anon"
  on public.cronograma_tareas for delete to anon using (true);

notify pgrst, 'reload schema';
