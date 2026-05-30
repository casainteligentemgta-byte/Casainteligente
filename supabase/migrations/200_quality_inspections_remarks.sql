-- Motivo de rechazo en cuarentena (depositario).
alter table public.quality_inspections
  add column if not exists remarks text;

comment on column public.quality_inspections.remarks is 'Motivo u observaciones (p. ej. rechazo en cuarentena).';
