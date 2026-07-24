-- Horas para costeo de personal por obra (calculateLaborCost).

alter table public.ci_obra_empleados
  add column if not exists horas_costeo_mes numeric(10, 2);

comment on column public.ci_obra_empleados.horas_costeo_mes is
  'Horas mensuales atribuidas al costeo (null = 160 h estándar en app).';

notify pgrst, 'reload schema';
