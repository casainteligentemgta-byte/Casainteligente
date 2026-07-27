-- Pegar en SQL Editor de Supabase si la migración 306 no se aplicó por CLI.
alter table public.ci_empleados
  add column if not exists hoja_vida_pdf_url text;

alter table public.ci_empleados
  add column if not exists hoja_empleo_pdf_url text;

comment on column public.ci_empleados.hoja_vida_pdf_url is
  'Storage path del PDF HOJA DE VIDA generado al enviar el cuestionario (bucket contratos_obreros).';

comment on column public.ci_empleados.hoja_empleo_pdf_url is
  'Storage path del PDF HOJA DE EMPLEO generado al contratar (mismos datos + patrono/obra).';

notify pgrst, 'reload schema';
