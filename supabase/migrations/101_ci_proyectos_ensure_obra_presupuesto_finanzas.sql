-- Columnas Talento / finanzas (086). Si 086 no corrió o se omitieron ALTERs,
-- PostgREST, la vista public.ci_obras y selects explícitos fallan con
-- "column ci_proyectos.obra_presupuesto_ves does not exist".
alter table public.ci_proyectos
  add column if not exists obra_presupuesto_ves numeric(14, 2);

alter table public.ci_proyectos
  add column if not exists obra_presupuesto_mano_obra_ves numeric(14, 2);

alter table public.ci_proyectos
  add column if not exists obra_fondo_reserva_liquidacion_ves numeric(14, 2);

comment on column public.ci_proyectos.obra_presupuesto_ves is
  'Presupuesto total de obra en VES (Talento). Unificado desde ex ci_obras.';

comment on column public.ci_proyectos.obra_presupuesto_mano_obra_ves is
  'Presupuesto mano de obra en VES (tabulador / costeo).';

comment on column public.ci_proyectos.obra_fondo_reserva_liquidacion_ves is
  'Fondo de reserva / liquidación en VES.';

notify pgrst, 'reload schema';
