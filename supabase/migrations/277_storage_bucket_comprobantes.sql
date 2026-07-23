-- Bucket público para facturas / comprobantes del CCO (link_factura, link_comprobante).

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do update set public = true;

drop policy if exists "comprobantes_select_anon" on storage.objects;
drop policy if exists "comprobantes_insert_anon" on storage.objects;
drop policy if exists "comprobantes_select_auth" on storage.objects;
drop policy if exists "comprobantes_insert_auth" on storage.objects;
drop policy if exists "comprobantes_update_auth" on storage.objects;
drop policy if exists "comprobantes_delete_auth" on storage.objects;

create policy "comprobantes_select_anon"
on storage.objects for select to anon
using (bucket_id = 'comprobantes');

create policy "comprobantes_select_auth"
on storage.objects for select to authenticated
using (bucket_id = 'comprobantes');

create policy "comprobantes_insert_auth"
on storage.objects for insert to authenticated
with check (bucket_id = 'comprobantes');

create policy "comprobantes_update_auth"
on storage.objects for update to authenticated
using (bucket_id = 'comprobantes')
with check (bucket_id = 'comprobantes');

create policy "comprobantes_delete_auth"
on storage.objects for delete to authenticated
using (bucket_id = 'comprobantes');

-- Service role bypasa RLS; políticas cubren cliente autenticado / lectura pública.

NOTIFY pgrst, 'reload schema';
