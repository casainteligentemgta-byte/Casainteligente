-- Tabulador de salarios (referencia tipo cuadro oficial): sueldo base, compensación, total, deducciones, neto, plazas.
-- Compatible con modelos que usan ISPT / seguro social (México) u otros esquemas: columnas opcionales.

alter table public.ci_config_nomina
  add column if not exists compensacion_garantizada numeric(14, 2) not null default 0 check (compensacion_garantizada >= 0);

alter table public.ci_config_nomina
  add column if not exists total_bruto_mensual numeric(14, 2);

alter table public.ci_config_nomina
  add column if not exists deduccion_ispt numeric(14, 2);

alter table public.ci_config_nomina
  add column if not exists deduccion_seguro_social numeric(14, 2);

alter table public.ci_config_nomina
  add column if not exists neto_mensual numeric(14, 2);

alter table public.ci_config_nomina
  add column if not exists plazas integer;

alter table public.ci_config_nomina
  drop constraint if exists ci_config_nomina_plazas_check;

alter table public.ci_config_nomina
  add constraint ci_config_nomina_plazas_check
  check (plazas is null or plazas >= 0);

comment on column public.ci_config_nomina.compensacion_garantizada is
  'Compensación garantizada u otros conceptos fijos mensuales del tabulador (además del sueldo base).';
comment on column public.ci_config_nomina.total_bruto_mensual is
  'Total bruto mensual del cuadro; si es null, la UI puede mostrar sueldo base + compensación.';
comment on column public.ci_config_nomina.deduccion_ispt is
  'Retención tipo ISPT u otra deducción fiscal mensual (referencia tabulador).';
comment on column public.ci_config_nomina.deduccion_seguro_social is
  'Deducción por seguro social (ej. IMSS) u homólogo.';
comment on column public.ci_config_nomina.neto_mensual is
  'Neto mensual del tabulador (después de deducciones).';
comment on column public.ci_config_nomina.plazas is
  'Número de plazas o cupos asociados al nivel en el cuadro (opcional).';

notify pgrst, 'reload schema';
