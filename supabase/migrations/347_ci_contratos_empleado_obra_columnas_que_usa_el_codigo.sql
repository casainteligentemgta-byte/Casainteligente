-- Contratos de trabajo: columnas que el código usa y que faltaban en la base.
--
-- La migración 083 (aceptación del contrato y ruta del PDF) nunca se había aplicado en
-- producción, y la tabla se creó sin «created_at». Con eso fallaban:
--   · el cuadro de firmas pendientes y el expediente del contrato (ordenan por created_at);
--   · la firma física y la descarga del contrato (leen obrero_aceptacion_contrato_at);
--   · la función firmar_contrato_y_asignar (usa ambas);
--   · el conteo de contratos del informe semanal de talento.
--
-- Solo agrega columnas. La tabla estaba vacía al aplicarla.

alter table public.ci_contratos_empleado_obra
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists obrero_aceptacion_contrato_at timestamptz,
  add column if not exists laboral_pdf_storage_path text;

comment on column public.ci_contratos_empleado_obra.obrero_aceptacion_contrato_at is
  'Marca cuando el trabajador aceptó el contrato laboral en la web (antes de imprimir y firmar en físico).';
comment on column public.ci_contratos_empleado_obra.laboral_pdf_storage_path is
  'Ruta en Storage del PDF definitivo (plantilla legal); opcional mientras se usa PDF generado en API.';

notify pgrst, 'reload schema';
