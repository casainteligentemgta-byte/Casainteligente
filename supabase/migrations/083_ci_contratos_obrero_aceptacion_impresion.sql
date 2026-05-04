-- Contrato laboral obrero: aceptación electrónica en web + impresión / firma física (RRHH).
-- No altera el trigger de 068; coexiste con firma de planilla en ci_empleados.

alter table public.ci_contratos_empleado_obra
  add column if not exists obrero_aceptacion_contrato_at timestamptz,
  add column if not exists laboral_pdf_storage_path text;

comment on column public.ci_contratos_empleado_obra.obrero_aceptacion_contrato_at is
  'Marca cuando el trabajador aceptó el contrato laboral en la web (antes de imprimir y firmar en físico).';
comment on column public.ci_contratos_empleado_obra.laboral_pdf_storage_path is
  'Ruta en Storage del PDF definitivo (plantilla legal); opcional mientras se usa PDF generado en API.';

notify pgrst, 'reload schema';
