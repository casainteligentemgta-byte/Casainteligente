-- Archivo original de factura / presupuesto (PDF o imagen) en Storage.

insert into storage.buckets (id, name, public)
values ('procurement-documents', 'procurement-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "procurement_documents_select_anon" on storage.objects;
drop policy if exists "procurement_documents_insert_anon" on storage.objects;
drop policy if exists "procurement_documents_update_anon" on storage.objects;
drop policy if exists "procurement_documents_select_auth" on storage.objects;
drop policy if exists "procurement_documents_insert_auth" on storage.objects;
drop policy if exists "procurement_documents_update_auth" on storage.objects;

create policy "procurement_documents_select_anon"
on storage.objects for select to anon
using (bucket_id = 'procurement-documents');

create policy "procurement_documents_insert_anon"
on storage.objects for insert to anon
with check (bucket_id = 'procurement-documents');

create policy "procurement_documents_update_anon"
on storage.objects for update to anon
using (bucket_id = 'procurement-documents')
with check (bucket_id = 'procurement-documents');

create policy "procurement_documents_select_auth"
on storage.objects for select to authenticated
using (bucket_id = 'procurement-documents');

create policy "procurement_documents_insert_auth"
on storage.objects for insert to authenticated
with check (bucket_id = 'procurement-documents');

create policy "procurement_documents_update_auth"
on storage.objects for update to authenticated
using (bucket_id = 'procurement-documents')
with check (bucket_id = 'procurement-documents');

alter table public.purchase_invoices
  add column if not exists document_storage_path text,
  add column if not exists document_file_name text,
  add column if not exists document_mime_type text;

comment on column public.purchase_invoices.document_storage_path is
  'Ruta en bucket procurement-documents del PDF/foto original.';
comment on column public.purchase_invoices.document_file_name is
  'Nombre original del archivo subido.';
comment on column public.purchase_invoices.document_mime_type is
  'MIME del archivo (application/pdf, image/jpeg, etc.).';
