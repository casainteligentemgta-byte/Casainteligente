-- Vigencias del tabulador: misma fila de oficio puede tener revisiones (p. ej. salarios futuros).
-- Relaja unicidad por nombre y la reemplaza por (código + vigencia) o (nombre + vigencia sin código).

alter table public.ci_config_nomina
  add column if not exists vigencia_desde date not null default '2023-06-20';

alter table public.ci_config_nomina
  add column if not exists tabulador_referencia text;

comment on column public.ci_config_nomina.vigencia_desde is
  'Desde qué fecha aplica esta fila del tabulador (inclusive). Permite registrar aumentos futuros.';
comment on column public.ci_config_nomina.tabulador_referencia is
  'Etiqueta de origen (ej. GOE 6.752 — 2023) o nota RRHH.';

drop index if exists idx_ci_config_nomina_cargo_nombre_lower;

create unique index if not exists idx_ci_config_nomina_codigo_vigencia
  on public.ci_config_nomina (lower(trim(cargo_codigo)), vigencia_desde)
  where cargo_codigo is not null and length(trim(cargo_codigo)) > 0;

create unique index if not exists idx_ci_config_nomina_nombre_vigencia_sin_codigo
  on public.ci_config_nomina (lower(trim(cargo_nombre)), vigencia_desde)
  where cargo_codigo is null or length(trim(cargo_codigo)) = 0;

notify pgrst, 'reload schema';
