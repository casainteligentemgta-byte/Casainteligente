-- Evaluación de personal de campo (obrero): DISC colores, aptitud lógica %, confiabilidad, tiempo.

alter table public.ci_empleados
  drop constraint if exists ci_empleados_rol_examen_check;

alter table public.ci_empleados
  add constraint ci_empleados_rol_examen_check
  check (rol_examen in ('programador', 'tecnico', 'obrero'));

alter table public.ci_empleados
  add column if not exists perfil_color text,
  add column if not exists puntuacion_logica numeric(6,2),
  add column if not exists puntuacion_confiabilidad numeric(6,2),
  add column if not exists tiempo_respuesta integer,
  add column if not exists estatus_evaluacion text,
  add column if not exists evaluacion_obrero_respuestas jsonb;

alter table public.ci_empleados
  drop constraint if exists ci_empleados_perfil_color_check;

alter table public.ci_empleados
  add constraint ci_empleados_perfil_color_check
  check (
    perfil_color is null
    or perfil_color in ('Rojo', 'Amarillo', 'Verde', 'Azul')
  );

alter table public.ci_empleados
  drop constraint if exists ci_empleados_estatus_evaluacion_check;

alter table public.ci_empleados
  add constraint ci_empleados_estatus_evaluacion_check
  check (
    estatus_evaluacion is null
    or estatus_evaluacion in ('completado', 'iniciado')
  );

alter table public.ci_empleados
  drop constraint if exists ci_empleados_tiempo_respuesta_check;

alter table public.ci_empleados
  add constraint ci_empleados_tiempo_respuesta_check
  check (tiempo_respuesta is null or tiempo_respuesta >= 0);

comment on column public.ci_empleados.perfil_color is
  'Perfil DISC simplificado (dominante): Rojo, Amarillo, Verde, Azul.';
comment on column public.ci_empleados.puntuacion_logica is
  'Aptitud lógica / razonamiento (0–100) — evaluación obrero.';
comment on column public.ci_empleados.puntuacion_confiabilidad is
  'Confiabilidad operativa (0–100) — evaluación obrero.';
comment on column public.ci_empleados.tiempo_respuesta is
  'Segundos totales desde inicio hasta envío (evaluación obrero).';
comment on column public.ci_empleados.estatus_evaluacion is
  'Ciclo evaluación obrero: iniciado | completado.';
comment on column public.ci_empleados.evaluacion_obrero_respuestas is
  'JSON de respuestas crudas (disc, lógica, confiabilidad) para auditoría.';
