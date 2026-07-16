-- Texto de horario acordado en el express (cláusula CUARTA del PDF estructurado).

alter table public.ci_contratos_express
  add column if not exists horario_semanal_texto text;

comment on column public.ci_contratos_express.horario_semanal_texto is
  'Detalle de jornada/horario semanal capturado al generar el contrato express (referencia legal y auditoría).';

notify pgrst, 'reload schema';
