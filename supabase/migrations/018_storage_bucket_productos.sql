-- Bucket alternativo "productos" (nombre esperado por algunos entornos / docs).
-- La app intenta subir a product-media y, si no existe, a productos.

insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists "productos select public" on storage.objects;
create policy "productos select public"
  on storage.objects for select
  using (bucket_id = 'productos');

drop policy if exists "productos insert anon" on storage.objects;
create policy "productos insert anon"
  on storage.objects for insert to anon
  with check (bucket_id = 'productos');

drop policy if exists "productos update anon" on storage.objects;
create policy "productos update anon"
  on storage.objects for update to anon
  using (bucket_id = 'productos')
  with check (bucket_id = 'productos');

drop policy if exists "productos delete anon" on storage.objects;
create policy "productos delete anon"
  on storage.objects for delete to anon
  using (bucket_id = 'productos');

-- Sesión Supabase Auth (rol authenticated)
drop policy if exists "productos insert authenticated" on storage.objects;
create policy "productos insert authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'productos');

drop policy if exists "productos update authenticated" on storage.objects;
create policy "productos update authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'productos')
  with check (bucket_id = 'productos');

drop policy if exists "productos delete authenticated" on storage.objects;
create policy "productos delete authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'productos');
