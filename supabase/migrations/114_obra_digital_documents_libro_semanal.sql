-- Libro de obra semanal: semana dentro del mes (1–5) + referencia mes/año.
-- No altera triggers de anticipo (recomendación solo en app).

alter table public.obra_digital_documents
  add column if not exists reference_week smallint;

alter table public.obra_digital_documents
  drop constraint if exists obra_digital_doc_libro_ref_chk;

alter table public.obra_digital_documents
  add constraint obra_digital_doc_libro_ref_chk
    check (
      doc_type <> 'LIBRO_OBRA_SEMANAL'
      or (
        reference_year is not null
        and reference_month is not null
        and reference_week is not null
        and reference_week >= 1
        and reference_week <= 5
      )
    );

comment on column public.obra_digital_documents.reference_week is
  'Para LIBRO_OBRA_SEMANAL: semana 1–5 dentro del mes (reference_month/year). Otros tipos: null.';

notify pgrst, 'reload schema';
