-- Avance físico/operativo del contrato: lo fija el operador (no se deriva de pagos).
-- Usado en CCO Contratos para conciliación (ejecutado) y sugerido a pagar desde el saco.

alter table public.cco_contratos_obra
  add column if not exists pct_avance numeric(5, 2) not null default 0
    check (pct_avance >= 0 and pct_avance <= 100);

comment on column public.cco_contratos_obra.pct_avance is
  'Porcentaje de avance del contrato (0-100). Editable por el operador; no se calcula desde pagos.';

notify pgrst, 'reload schema';
