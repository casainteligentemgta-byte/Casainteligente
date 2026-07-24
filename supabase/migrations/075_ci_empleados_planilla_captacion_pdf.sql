alter table public.ci_empleados
  add column if not exists planilla_captacion_pdf_url text;

comment on column public.ci_empleados.planilla_captacion_pdf_url is
  'Storage path o URL del PDF Anexo I generado en captación automática (bucket contratos_obreros).';

notify pgrst, 'reload schema';
