-- Onboarding móvil por token de registro (hoja de vida simplificada).

alter table public.ci_empleados
  add column if not exists token_registro text,
  add column if not exists cedula text,
  add column if not exists talla_camisa text,
  add column if not exists talla_botas text,
  add column if not exists cedula_foto_url text,
  add column if not exists estado_proceso text not null default 'pendiente_cv';

create unique index if not exists idx_ci_empleados_token_registro
  on public.ci_empleados (token_registro)
  where token_registro is not null;

alter table public.ci_empleados
  drop constraint if exists ci_empleados_estado_proceso_check;

alter table public.ci_empleados
  add constraint ci_empleados_estado_proceso_check
  check (estado_proceso in ('pendiente_cv', 'cv_completado', 'examen_iniciado', 'examen_completado'));

comment on column public.ci_empleados.token_registro is
  'Token de acceso a onboarding móvil de hoja de vida.';
comment on column public.ci_empleados.estado_proceso is
  'Flujo onboarding: pendiente_cv -> cv_completado -> examen_iniciado -> examen_completado.';
