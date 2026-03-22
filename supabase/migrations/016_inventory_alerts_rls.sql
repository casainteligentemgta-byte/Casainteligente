-- Alertas de inventario: misma lógica que global_inventory (anon + authenticated).
-- Ejecutar si aparece: "new row violates row-level security policy for table inventory_alerts"

alter table public.inventory_alerts enable row level security;

-- anon
drop policy if exists "Permitir leer inventory_alerts" on public.inventory_alerts;
drop policy if exists "Permitir insertar inventory_alerts" on public.inventory_alerts;
drop policy if exists "Permitir actualizar inventory_alerts" on public.inventory_alerts;
drop policy if exists "Permitir borrar inventory_alerts" on public.inventory_alerts;

create policy "Permitir leer inventory_alerts"
  on public.inventory_alerts for select to anon using (true);
create policy "Permitir insertar inventory_alerts"
  on public.inventory_alerts for insert to anon with check (true);
create policy "Permitir actualizar inventory_alerts"
  on public.inventory_alerts for update to anon using (true) with check (true);
create policy "Permitir borrar inventory_alerts"
  on public.inventory_alerts for delete to anon using (true);

-- authenticated (usuarios con sesión)
drop policy if exists "Permitir leer inventory_alerts authenticated" on public.inventory_alerts;
drop policy if exists "Permitir insertar inventory_alerts authenticated" on public.inventory_alerts;
drop policy if exists "Permitir actualizar inventory_alerts authenticated" on public.inventory_alerts;
drop policy if exists "Permitir borrar inventory_alerts authenticated" on public.inventory_alerts;

create policy "Permitir leer inventory_alerts authenticated"
  on public.inventory_alerts for select to authenticated using (true);
create policy "Permitir insertar inventory_alerts authenticated"
  on public.inventory_alerts for insert to authenticated with check (true);
create policy "Permitir actualizar inventory_alerts authenticated"
  on public.inventory_alerts for update to authenticated using (true) with check (true);
create policy "Permitir borrar inventory_alerts authenticated"
  on public.inventory_alerts for delete to authenticated using (true);
