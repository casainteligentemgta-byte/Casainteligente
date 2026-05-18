-- Recepción de mercancía: la app usa clave anon en el navegador.
-- Sin políticas anon en purchase_* los INSERT fallan por RLS (el botón "no hace nada").

alter table public.purchase_invoices enable row level security;
alter table public.purchase_details enable row level security;
alter table public.quality_inspections enable row level security;

-- purchase_invoices
drop policy if exists "Allow authenticated Read" on public.purchase_invoices;
drop policy if exists "Allow authenticated Insert" on public.purchase_invoices;
drop policy if exists "Allow authenticated Update" on public.purchase_invoices;
drop policy if exists "Permitir leer purchase_invoices" on public.purchase_invoices;
drop policy if exists "Permitir insertar purchase_invoices" on public.purchase_invoices;
drop policy if exists "Permitir actualizar purchase_invoices" on public.purchase_invoices;

create policy "Permitir leer purchase_invoices"
  on public.purchase_invoices for select to anon using (true);
create policy "Permitir insertar purchase_invoices"
  on public.purchase_invoices for insert to anon with check (true);
create policy "Permitir actualizar purchase_invoices"
  on public.purchase_invoices for update to anon using (true) with check (true);

create policy "Permitir leer purchase_invoices authenticated"
  on public.purchase_invoices for select to authenticated using (true);
create policy "Permitir insertar purchase_invoices authenticated"
  on public.purchase_invoices for insert to authenticated with check (true);
create policy "Permitir actualizar purchase_invoices authenticated"
  on public.purchase_invoices for update to authenticated using (true) with check (true);

-- purchase_details
drop policy if exists "Allow authenticated Read" on public.purchase_details;
drop policy if exists "Allow authenticated Insert" on public.purchase_details;
drop policy if exists "Permitir leer purchase_details" on public.purchase_details;
drop policy if exists "Permitir insertar purchase_details" on public.purchase_details;

create policy "Permitir leer purchase_details"
  on public.purchase_details for select to anon using (true);
create policy "Permitir insertar purchase_details"
  on public.purchase_details for insert to anon with check (true);

create policy "Permitir leer purchase_details authenticated"
  on public.purchase_details for select to authenticated using (true);
create policy "Permitir insertar purchase_details authenticated"
  on public.purchase_details for insert to authenticated with check (true);

-- quality_inspections
drop policy if exists "Allow authenticated Read" on public.quality_inspections;
drop policy if exists "Allow authenticated Insert" on public.quality_inspections;
drop policy if exists "Allow authenticated Update" on public.quality_inspections;
drop policy if exists "Permitir leer quality_inspections" on public.quality_inspections;
drop policy if exists "Permitir insertar quality_inspections" on public.quality_inspections;
drop policy if exists "Permitir actualizar quality_inspections" on public.quality_inspections;

create policy "Permitir leer quality_inspections"
  on public.quality_inspections for select to anon using (true);
create policy "Permitir insertar quality_inspections"
  on public.quality_inspections for insert to anon with check (true);
create policy "Permitir actualizar quality_inspections"
  on public.quality_inspections for update to anon using (true) with check (true);

create policy "Permitir leer quality_inspections authenticated"
  on public.quality_inspections for select to authenticated using (true);
create policy "Permitir insertar quality_inspections authenticated"
  on public.quality_inspections for insert to authenticated with check (true);
create policy "Permitir actualizar quality_inspections authenticated"
  on public.quality_inspections for update to authenticated using (true) with check (true);
