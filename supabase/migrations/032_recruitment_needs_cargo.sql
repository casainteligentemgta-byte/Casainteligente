-- Datos del tabulador de oficios (Conv. Colectiva Construcción 2023) por vacante.

alter table public.recruitment_needs
  add column if not exists cargo_codigo text,
  add column if not exists cargo_nombre text,
  add column if not exists cargo_nivel integer,
  add column if not exists tipo_vacante text;

alter table public.recruitment_needs
  drop constraint if exists recruitment_needs_cargo_nivel_check;

alter table public.recruitment_needs
  add constraint recruitment_needs_cargo_nivel_check
  check (cargo_nivel is null or (cargo_nivel >= 1 and cargo_nivel <= 9));

alter table public.recruitment_needs
  drop constraint if exists recruitment_needs_tipo_vacante_check;

alter table public.recruitment_needs
  add constraint recruitment_needs_tipo_vacante_check
  check (
    tipo_vacante is null
    or tipo_vacante in ('obrero_basico', 'obrero_especializado')
  );

comment on column public.recruitment_needs.cargo_codigo is
  'Código de oficio del tabulador (ej. 5.1, 3.22).';
comment on column public.recruitment_needs.cargo_nombre is
  'Denominación oficial del cargo.';
comment on column public.recruitment_needs.cargo_nivel is
  'Nivel salarial 1–9.';
comment on column public.recruitment_needs.tipo_vacante is
  'obrero_basico (niveles 1–4) u obrero_especializado (5–9).';
