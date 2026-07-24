-- Nivel salarial GOE (1–9) por fila del tabulador; opcional si solo se usa código u homónimo.

alter table public.ci_config_nomina
  add column if not exists nivel_salarial smallint;

alter table public.ci_config_nomina
  drop constraint if exists ci_config_nomina_nivel_salarial_check;

alter table public.ci_config_nomina
  add constraint ci_config_nomina_nivel_salarial_check
  check (nivel_salarial is null or (nivel_salarial >= 1 and nivel_salarial <= 9));

comment on column public.ci_config_nomina.nivel_salarial is
  'Nivel salarial 1–9 del tabulador de oficios (GOE); alineado con el anexo. Null = inferir por código en UI o sin clasificar.';

notify pgrst, 'reload schema';
