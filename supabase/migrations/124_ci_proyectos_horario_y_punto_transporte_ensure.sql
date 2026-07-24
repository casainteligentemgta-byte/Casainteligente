-- Columnas usadas por contratos PDF / express en `ci_proyectos` (por si faltan 115 o 117 en el entorno).

alter table public.ci_proyectos add column if not exists horario_semanal_obra_default text;
alter table public.ci_proyectos add column if not exists punto_encuentro_transporte_contrato text;

comment on column public.ci_proyectos.horario_semanal_obra_default is
  'Horario semanal por defecto de la obra (PDF contrato); migración 115.';
comment on column public.ci_proyectos.punto_encuentro_transporte_contrato is
  'Punto de encuentro transporte cláusula SEXTA PDF; migración 117.';

notify pgrst, 'reload schema';
