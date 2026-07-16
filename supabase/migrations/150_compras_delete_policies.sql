-- Repara políticas DELETE de compras/recepción (p. ej. si 141 dejó solo SELECT/INSERT).

drop policy if exists "Permitir borrar contabilidad_compras anon" on public.contabilidad_compras;
drop policy if exists "Permitir borrar contabilidad_compras authenticated" on public.contabilidad_compras;
drop policy if exists "Permitir borrar contabilidad_compra_lineas anon" on public.contabilidad_compra_lineas;
drop policy if exists "Permitir borrar contabilidad_compra_lineas authenticated" on public.contabilidad_compra_lineas;
drop policy if exists "Permitir borrar purchase_invoices anon" on public.purchase_invoices;
drop policy if exists "Permitir borrar purchase_invoices authenticated" on public.purchase_invoices;
drop policy if exists "Permitir borrar purchase_details anon" on public.purchase_details;
drop policy if exists "Permitir borrar purchase_details authenticated" on public.purchase_details;
drop policy if exists "Permitir borrar quality_inspections anon" on public.quality_inspections;
drop policy if exists "Permitir borrar quality_inspections authenticated" on public.quality_inspections;

create policy "Permitir borrar contabilidad_compras anon"
  on public.contabilidad_compras for delete to anon using (true);
create policy "Permitir borrar contabilidad_compras authenticated"
  on public.contabilidad_compras for delete to authenticated using (true);

create policy "Permitir borrar contabilidad_compra_lineas anon"
  on public.contabilidad_compra_lineas for delete to anon using (true);
create policy "Permitir borrar contabilidad_compra_lineas authenticated"
  on public.contabilidad_compra_lineas for delete to authenticated using (true);

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

notify pgrst, 'reload schema';
