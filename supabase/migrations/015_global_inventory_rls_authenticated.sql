-- Usuarios con sesión (JWT) usan el rol "authenticated", no "anon".
-- Sin políticas para authenticated, INSERT/UPDATE en global_inventory fallan con RLS.

alter table public.global_inventory enable row level security;

drop policy if exists "Permitir leer global_inventory authenticated" on public.global_inventory;
drop policy if exists "Permitir insertar global_inventory authenticated" on public.global_inventory;
drop policy if exists "Permitir actualizar global_inventory authenticated" on public.global_inventory;
drop policy if exists "Permitir borrar global_inventory authenticated" on public.global_inventory;

create policy "Permitir leer global_inventory authenticated"
  on public.global_inventory for select to authenticated using (true);

create policy "Permitir insertar global_inventory authenticated"
  on public.global_inventory for insert to authenticated with check (true);

create policy "Permitir actualizar global_inventory authenticated"
  on public.global_inventory for update to authenticated using (true) with check (true);

create policy "Permitir borrar global_inventory authenticated"
  on public.global_inventory for delete to authenticated using (true);
