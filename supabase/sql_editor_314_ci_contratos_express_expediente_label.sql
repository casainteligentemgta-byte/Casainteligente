-- Ejecutar en SQL Editor de Supabase (producción) si la migración 314 aún no está aplicada.

alter table public.ci_contratos_express
  add column if not exists expediente_label text;

comment on column public.ci_contratos_express.expediente_label is
  'Expediente del contrato individual: AÑO-MES-ENTIDAD-OBRA-Número (sin prefijo EXPRESS).';

create index if not exists idx_ci_contratos_express_expediente
  on public.ci_contratos_express (expediente_label);

notify pgrst, 'reload schema';
