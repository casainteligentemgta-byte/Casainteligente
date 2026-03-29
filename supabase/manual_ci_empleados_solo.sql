-- =============================================================================
-- CASA INTELIGENTE — Instalación mínima de public.ci_empleados (examen de talento)
-- Ejecuta TODO este archivo en: Supabase → SQL Editor → New query → Run
-- Corrige: "Could not find the table 'public.ci_empleados' in the schema cache"
-- Después: Settings → API → "Reload" o espera 1–2 min; si persiste, reinicia el proyecto.
-- =============================================================================

create table if not exists public.ci_empleados (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  email text,
  documento text,
  telefono text,
  rol_examen text not null check (rol_examen in ('programador', 'tecnico')),
  respuestas_personalidad jsonb not null default '[]'::jsonb,
  respuestas_logica jsonb not null default '[]'::jsonb,
  puntaje_personalidad numeric(6,2),
  puntaje_logica numeric(6,2),
  puntaje_total numeric(6,2),
  semaforo text check (semaforo in ('verde', 'amarillo', 'rojo')),
  estado text not null default 'evaluacion_pendiente'
    check (estado in ('evaluacion_pendiente', 'aprobado', 'rechazado')),
  examen_inicio_at timestamptz,
  examen_completado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_empleados_estado on public.ci_empleados (estado);
create index if not exists idx_ci_empleados_semaforo on public.ci_empleados (semaforo);

alter table public.ci_empleados
  add column if not exists gma_0_5 smallint check (gma_0_5 is null or (gma_0_5 >= 0 and gma_0_5 <= 5));

alter table public.ci_empleados
  add column if not exists nivel_integridad_riesgo numeric(4,2);

alter table public.ci_empleados
  add column if not exists completo_en_tiempo boolean;

alter table public.ci_empleados
  add column if not exists motivo_semaforo text;

alter table public.ci_empleados
  add column if not exists color_disc text;

alter table public.ci_empleados
  add column if not exists status_evaluacion text
  check (
    status_evaluacion is null
    or status_evaluacion in ('verde', 'amarillo', 'rojo', 'rechazado')
  );

alter table public.ci_empleados
  add column if not exists rol_buscado text;

alter table public.ci_empleados enable row level security;

drop policy if exists "ci_empleados_select_anon" on public.ci_empleados;
drop policy if exists "ci_empleados_insert_anon" on public.ci_empleados;
drop policy if exists "ci_empleados_update_anon" on public.ci_empleados;
drop policy if exists "ci_empleados_delete_anon" on public.ci_empleados;
drop policy if exists "ci_empleados_select_auth" on public.ci_empleados;
drop policy if exists "ci_empleados_insert_auth" on public.ci_empleados;
drop policy if exists "ci_empleados_update_auth" on public.ci_empleados;
drop policy if exists "ci_empleados_delete_auth" on public.ci_empleados;

create policy "ci_empleados_select_anon" on public.ci_empleados for select to anon using (true);
create policy "ci_empleados_insert_anon" on public.ci_empleados for insert to anon with check (true);
create policy "ci_empleados_update_anon" on public.ci_empleados for update to anon using (true) with check (true);
create policy "ci_empleados_delete_anon" on public.ci_empleados for delete to anon using (true);
create policy "ci_empleados_select_auth" on public.ci_empleados for select to authenticated using (true);
create policy "ci_empleados_insert_auth" on public.ci_empleados for insert to authenticated with check (true);
create policy "ci_empleados_update_auth" on public.ci_empleados for update to authenticated using (true) with check (true);
create policy "ci_empleados_delete_auth" on public.ci_empleados for delete to authenticated using (true);
