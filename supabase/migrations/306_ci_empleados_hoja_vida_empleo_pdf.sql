-- PDFs generados desde la ficha única del obrero:
-- hoja de vida al enviar el cuestionario; hoja de empleo al contratar.
alter table public.ci_empleados
  add column if not exists hoja_vida_pdf_url text;

alter table public.ci_empleados
  add column if not exists hoja_empleo_pdf_url text;

comment on column public.ci_empleados.hoja_vida_pdf_url is
  'Storage path del PDF HOJA DE VIDA generado al enviar el cuestionario (bucket contratos_obreros).';

comment on column public.ci_empleados.hoja_empleo_pdf_url is
  'Storage path del PDF HOJA DE EMPLEO generado al contratar (mismos datos + patrono/obra).';

comment on column public.ci_empleados.planilla_captacion_pdf_url is
  'Compat: path del PDF de captación; preferir hoja_vida_pdf_url (HV al enviar) u hoja_empleo_pdf_url (al contratar).';

notify pgrst, 'reload schema';
