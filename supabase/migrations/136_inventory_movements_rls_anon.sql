-- Movimientos de kardex (101 internamiento): permitir anon como en global_inventory.

alter table public.inventory_movements enable row level security;

drop policy if exists "Allow authenticated Read" on public.inventory_movements;
drop policy if exists "Allow authenticated Insert" on public.inventory_movements;
drop policy if exists "Permitir leer inventory_movements" on public.inventory_movements;
drop policy if exists "Permitir insertar inventory_movements" on public.inventory_movements;

create policy "Permitir leer inventory_movements"
  on public.inventory_movements for select to anon using (true);
create policy "Permitir insertar inventory_movements"
  on public.inventory_movements for insert to anon with check (true);

create policy "Permitir leer inventory_movements authenticated"
  on public.inventory_movements for select to authenticated using (true);
create policy "Permitir insertar inventory_movements authenticated"
  on public.inventory_movements for insert to authenticated with check (true);
