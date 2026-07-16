-- PDF (o escaneo) firmado por el obrero, subido tras la firma física.

alter table public.ci_contratos_express
  add column if not exists pdf_firmado_storage_path text,
  add column if not exists pdf_firmado_subido_at timestamptz;

comment on column public.ci_contratos_express.pdf_firmado_storage_path is
  'Ruta en bucket contratos_obreros del PDF o imagen firmada (express/{id}/…).';
comment on column public.ci_contratos_express.pdf_firmado_subido_at is
  'Marca de tiempo de la última subida del documento firmado.';

notify pgrst, 'reload schema';
