-- Ejecutar en Supabase → SQL Editor → Run (una sola vez).
-- Luego: Settings → API → Reload schema (o NOTIFY al final de este script).

-- ─── 143: gastos_obra + RLS ───────────────────────────────────────────────
create table if not exists public.gastos_obra (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo varchar not null default '',
  disciplina varchar not null default '',
  proveedor varchar not null default '',
  descripcion text,
  costo numeric(15, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gastos_obra enable row level security;

drop policy if exists "gastos_obra_select_anon" on public.gastos_obra;
drop policy if exists "gastos_obra_insert_anon" on public.gastos_obra;
drop policy if exists "gastos_obra_update_anon" on public.gastos_obra;
drop policy if exists "gastos_obra_delete_anon" on public.gastos_obra;
drop policy if exists "gastos_obra_select_auth" on public.gastos_obra;
drop policy if exists "gastos_obra_update_auth" on public.gastos_obra;

create policy "gastos_obra_select_anon" on public.gastos_obra for select to anon using (true);
create policy "gastos_obra_insert_anon" on public.gastos_obra for insert to anon with check (true);
create policy "gastos_obra_update_anon" on public.gastos_obra for update to anon using (true) with check (true);
create policy "gastos_obra_delete_anon" on public.gastos_obra for delete to anon using (true);

create policy "gastos_obra_select_auth" on public.gastos_obra for select to authenticated using (true);
create policy "gastos_obra_update_auth" on public.gastos_obra for update to authenticated using (true) with check (true);

-- ─── 144: tasa BCV y total USD (compras / recepción) ───────────────────────
alter table public.purchase_invoices
  add column if not exists moneda text,
  add column if not exists tasa_bcv_ves_por_usd numeric(18, 6),
  add column if not exists total_amount_usd numeric(15, 2);

update public.purchase_invoices set moneda = 'VES' where moneda is null;
alter table public.purchase_invoices alter column moneda set default 'VES';

alter table public.contabilidad_compras
  add column if not exists tasa_bcv_ves_por_usd numeric(18, 6),
  add column if not exists total_amount_usd numeric(15, 2);

comment on column public.purchase_invoices.tasa_bcv_ves_por_usd is
  'Tasa oficial BCV (bolívares por 1 USD) vigente en la fecha de la factura.';
comment on column public.purchase_invoices.total_amount_usd is
  'Total de la factura convertido a USD con la tasa BCV del día.';
comment on column public.contabilidad_compras.tasa_bcv_ves_por_usd is
  'Tasa BCV (Bs/USD) usada al registrar la compra.';
comment on column public.contabilidad_compras.total_amount_usd is
  'Monto total en USD (total_amount en Bs ÷ tasa BCV).';

notify pgrst, 'reload schema';
