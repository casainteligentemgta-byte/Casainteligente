-- Semáforo de riesgo (evaluación obrero / RRHH) y años de experiencia para la «Regla de Paradoja» (alerta CEO).

alter table public.ci_empleados
  add column if not exists semaforo_riesgo text,
  add column if not exists anos_experiencia smallint,
  add column if not exists motivo_semaforo_riesgo text;

alter table public.ci_empleados
  drop constraint if exists ci_empleados_semaforo_riesgo_check;

alter table public.ci_empleados
  add constraint ci_empleados_semaforo_riesgo_check
  check (
    semaforo_riesgo is null
    or semaforo_riesgo in ('verde', 'amarillo', 'rojo')
  );

alter table public.ci_empleados
  drop constraint if exists ci_empleados_anos_experiencia_check;

alter table public.ci_empleados
  add constraint ci_empleados_anos_experiencia_check
  check (anos_experiencia is null or (anos_experiencia >= 0 and anos_experiencia <= 80));

comment on column public.ci_empleados.semaforo_riesgo is
  'Riesgo contratación obrero (verde|amarillo|rojo), p. ej. desde calcularRiesgoObrero.';
comment on column public.ci_empleados.anos_experiencia is
  'Años de experiencia (entero). Usado en Regla de Paradoja vs semaforo_riesgo (≥10 + rojo → alerta CEO).';
comment on column public.ci_empleados.motivo_semaforo_riesgo is
  'Texto breve del motivo del semáforo de riesgo (para alertas y auditoría).';
