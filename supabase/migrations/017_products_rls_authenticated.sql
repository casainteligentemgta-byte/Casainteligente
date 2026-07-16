-- Usuarios con sesión necesitan políticas en `products`; si no, el UPDATE no aplica filas (RLS).

alter table public.products enable row level security;

drop policy if exists "Permitir leer products authenticated" on public.products;
drop policy if exists "Permitir insertar products authenticated" on public.products;
drop policy if exists "Permitir actualizar products authenticated" on public.products;
drop policy if exists "Permitir borrar products authenticated" on public.products;

create policy "Permitir leer products authenticated"
  on public.products for select to authenticated using (true);
create policy "Permitir insertar products authenticated"
  on public.products for insert to authenticated with check (true);
create policy "Permitir actualizar products authenticated"
  on public.products for update to authenticated using (true) with check (true);
create policy "Permitir borrar products authenticated"
  on public.products for delete to authenticated using (true);
