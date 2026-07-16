-- Contrato laboral (registro obrero): constancia PDF de aceptación digital, escaneo firmado y metadatos de cliente.

alter table public.ci_contratos_empleado_obra
  add column if not exists laboral_pdf_generado_at timestamptz,
  add column if not exists laboral_constancia_aceptacion_storage_path text,
  add column if not exists laboral_escaneo_firmado_storage_path text,
  add column if not exists laboral_escaneo_firmado_at timestamptz,
  add column if not exists obrero_aceptacion_cliente jsonb;

comment on column public.ci_contratos_empleado_obra.laboral_pdf_generado_at is
  'Primera vez que se archivó en Storage el PDF de plantilla servido al obrero.';
comment on column public.ci_contratos_empleado_obra.laboral_constancia_aceptacion_storage_path is
  'Ruta en bucket contratos_obreros: constancia de aceptación electrónica generada al aceptar.';
comment on column public.ci_contratos_empleado_obra.laboral_escaneo_firmado_storage_path is
  'Ruta en bucket contratos_obreros: PDF escaneado del contrato firmado en físico.';
comment on column public.ci_contratos_empleado_obra.laboral_escaneo_firmado_at is
  'Marca de carga del escaneo firmado (RRHH).';
comment on column public.ci_contratos_empleado_obra.obrero_aceptacion_cliente is
  'Metadatos opcionales de la aceptación (p. ej. ip, user_agent).';

notify pgrst, 'reload schema';
