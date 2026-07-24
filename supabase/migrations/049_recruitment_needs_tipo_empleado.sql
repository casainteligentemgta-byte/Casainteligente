-- Permite requisiciones de personal administrativo / empleado (además de obreros).

alter table public.recruitment_needs
  drop constraint if exists recruitment_needs_tipo_vacante_check;

alter table public.recruitment_needs
  add constraint recruitment_needs_tipo_vacante_check
  check (
    tipo_vacante is null
    or tipo_vacante in ('obrero_basico', 'obrero_especializado', 'empleado')
  );

comment on column public.recruitment_needs.tipo_vacante is
  'obrero_basico (niveles 1–4), obrero_especializado (5–9), empleado (administrativo / oficina).';
