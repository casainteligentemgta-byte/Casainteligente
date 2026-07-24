-- Subidas con usuario logueado al bucket product-media (012 solo tenía anon).

drop policy if exists "product-media insert authenticated" on storage.objects;
create policy "product-media insert authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-media');

drop policy if exists "product-media update authenticated" on storage.objects;
create policy "product-media update authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-media')
  with check (bucket_id = 'product-media');

drop policy if exists "product-media delete authenticated" on storage.objects;
create policy "product-media delete authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-media');
