-- Idempotente: asegura columnas de cargo/tabular en ci_empleados si una base omitió 033 o quedó a medias.
-- Corrige errores tipo: Could not find the 'cargo_codigo' column of 'ci_empleados' in the schema cache.

alter table public.ci_empleados
  add column if not exists cargo_codigo text,
  add column if not exists cargo_nombre text,
  add column if not exists cargo_nivel integer,
  add column if not exists tipo_vacante text;

alter table public.ci_empleados
  drop constraint if exists ci_empleados_cargo_nivel_check;

alter table public.ci_empleados
  add constraint ci_empleados_cargo_nivel_check
  check (cargo_nivel is null or (cargo_nivel >= 1 and cargo_nivel <= 9));

alter table public.ci_empleados
  drop constraint if exists ci_empleados_tipo_vacante_check;

alter table public.ci_empleados
  add constraint ci_empleados_tipo_vacante_check
  check (
    tipo_vacante is null
    or tipo_vacante in ('obrero_basico', 'obrero_especializado')
  );

comment on column public.ci_empleados.cargo_codigo is
  'Oficio según tabulador convención colectiva construcción (código).';
comment on column public.ci_empleados.cargo_nombre is
  'Denominación oficial del cargo.';
comment on column public.ci_empleados.cargo_nivel is
  'Nivel 1–9.';
comment on column public.ci_empleados.tipo_vacante is
  'Clasificación derivada del nivel (básico vs especializado).';

notify pgrst, 'reload schema';
