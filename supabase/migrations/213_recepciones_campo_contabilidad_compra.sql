-- Enlace directo FRM ↔ contabilidad_compras (ingreso provisional y conciliación fiscal posterior).

alter table public.ci_recepciones_campo
  add column if not exists contabilidad_compra_id uuid
  references public.contabilidad_compras (id) on delete set null;

create index if not exists idx_ci_recepciones_campo_contabilidad
  on public.ci_recepciones_campo (contabilidad_compra_id)
  where contabilidad_compra_id is not null;

comment on column public.ci_recepciones_campo.contabilidad_compra_id is
  'Compra contable creada al registrar el ingreso en campo (cantidades). Conciliación fiscal actualiza esta fila.';

notify pgrst, 'reload schema';
