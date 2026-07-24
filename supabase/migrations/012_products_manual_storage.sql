-- Campos de manual / instrucciones y bucket público para fotos y PDFs de productos.
-- La columna `imagen` ya existe en `products` (URL pública).

alter table public.products
  add column if not exists manual_instrucciones text,
  add column if not exists manual_documento_url text;

comment on column public.products.imagen is 'URL pública de la foto (p. ej. Supabase Storage)';
comment on column public.products.manual_instrucciones is 'Texto de instrucciones de uso o instalación';
comment on column public.products.manual_documento_url is 'URL pública del manual (PDF u otro)';

-- Bucket para imágenes y manuales (lectura pública; subida con anon como el resto del proyecto)
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do update set public = true;

-- Políticas de objects (idempotentes)
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
