-- Inventario: la app usa Supabase con clave ANON en el navegador.
-- Políticas solo para `authenticated` → error: "new row violates row-level security policy".
-- Igual que products/customers: políticas para rol `anon`.
--
-- Si también tienes material_categories, purchase_*, etc., ejecuta el SQL extra del final
-- o repite el mismo patrón en el SQL Editor.

alter table public.global_inventory enable row level security;

drop policy if exists "Allow authenticated Read" on public.global_inventory;
drop policy if exists "Allow authenticated Insert" on public.global_inventory;
drop policy if exists "Allow authenticated Update" on public.global_inventory;
drop policy if exists "Allow authenticated Delete" on public.global_inventory;

drop policy if exists "Permitir leer global_inventory" on public.global_inventory;
drop policy if exists "Permitir insertar global_inventory" on public.global_inventory;
drop policy if exists "Permitir actualizar global_inventory" on public.global_inventory;
drop policy if exists "Permitir borrar global_inventory" on public.global_inventory;

create policy "Permitir leer global_inventory"
  on public.global_inventory for select to anon using (true);
create policy "Permitir insertar global_inventory"
  on public.global_inventory for insert to anon with check (true);
create policy "Permitir actualizar global_inventory"
  on public.global_inventory for update to anon using (true) with check (true);
create policy "Permitir borrar global_inventory"
  on public.global_inventory for delete to anon using (true);
