-- Cuerpo estructurado (bloques tipados) para contratos / documentos legales.

alter table public.ci_legal_documentos
  add column if not exists cuerpo_estructurado jsonb;

comment on column public.ci_legal_documentos.cuerpo_estructurado is
  'JSON { document_title, blocks: [{ type, content }] } — title|paragraph|clause|table|...';

notify pgrst, 'reload schema';
