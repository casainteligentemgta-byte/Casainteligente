-- =============================================================================
-- Storage: fotos y PDFs de productos (Supabase SQL Editor → Run)
-- Crea los buckets product-media y productos + políticas anon y authenticated.
-- =============================================================================

-- Columnas en products (si faltan)
alter table public.products
  add column if not exists manual_instrucciones text,
  add column if not exists manual_documento_url text;

-- ── Bucket product-media ───────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do update set public = true;

drop policy if exists "product-media select public" on storage.objects;
create policy "product-media select public"
  on storage.objects for select
  using (bucket_id = 'product-media');

drop policy if exists "product-media insert anon" on storage.objects;
create policy "product-media insert anon"
  on storage.objects for insert to anon
  with check (bucket_id = 'product-media');

drop policy if exists "product-media update anon" on storage.objects;
create policy "product-media update anon"
  on storage.objects for update to anon
  using (bucket_id = 'product-media')
  with check (bucket_id = 'product-media');

drop policy if exists "product-media delete anon" on storage.objects;
create policy "product-media delete anon"
  on storage.objects for delete to anon
  using (bucket_id = 'product-media');

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

-- ── Bucket productos (nombre alternativo que pide a veces la app / docs) ──
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

-- =============================================================================
-- Listo. En Storage deberías ver "product-media" y "productos" (públicos).
-- =============================================================================
