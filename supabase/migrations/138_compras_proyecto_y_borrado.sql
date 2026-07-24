-- Compras vinculadas a proyecto + permisos de borrado (anon).

alter table public.purchase_invoices
  add column if not exists proyecto_id uuid references public.ci_proyectos(id) on delete set null;

alter table public.contabilidad_compras
  add column if not exists proyecto_id uuid references public.ci_proyectos(id) on delete set null;

create index if not exists idx_purchase_invoices_proyecto
  on public.purchase_invoices (proyecto_id);

create index if not exists idx_contabilidad_compras_proyecto
  on public.contabilidad_compras (proyecto_id);

comment on column public.purchase_invoices.proyecto_id is
  'Proyecto / obra al que se imputa la compra de mercancía.';
comment on column public.contabilidad_compras.proyecto_id is
  'Proyecto / obra al que se imputa el egreso en contabilidad.';

-- Borrado contabilidad
create policy "Permitir borrar contabilidad_compras anon"
  on public.contabilidad_compras for delete to anon using (true);
create policy "Permitir borrar contabilidad_compras authenticated"
  on public.contabilidad_compras for delete to authenticated using (true);

create policy "Permitir borrar contabilidad_compra_lineas anon"
  on public.contabilidad_compra_lineas for delete to anon using (true);
create policy "Permitir borrar contabilidad_compra_lineas authenticated"
  on public.contabilidad_compra_lineas for delete to authenticated using (true);

-- Borrado recepción (revertir compra completa)
create policy "Permitir borrar purchase_invoices anon"
  on public.purchase_invoices for delete to anon using (true);
create policy "Permitir borrar purchase_invoices authenticated"
  on public.purchase_invoices for delete to authenticated using (true);

create policy "Permitir borrar purchase_details anon"
  on public.purchase_details for delete to anon using (true);
create policy "Permitir borrar purchase_details authenticated"
  on public.purchase_details for delete to authenticated using (true);

create policy "Permitir borrar quality_inspections anon"
  on public.quality_inspections for delete to anon using (true);
create policy "Permitir borrar quality_inspections authenticated"
  on public.quality_inspections for delete to authenticated using (true);
