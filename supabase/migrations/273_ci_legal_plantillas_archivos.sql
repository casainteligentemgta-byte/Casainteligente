-- Formatos legales: archivo original adjunto + bucket de storage.

alter table public.ci_legal_plantillas
  add column if not exists archivo_storage_path text,
  add column if not exists archivo_nombre text,
  add column if not exists archivo_mime text;

comment on column public.ci_legal_plantillas.archivo_storage_path is
  'Ruta en bucket legal-plantillas del formato subido (PDF/DOCX/MD).';
comment on column public.ci_legal_plantillas.archivo_nombre is
  'Nombre original del archivo de formato.';
comment on column public.ci_legal_plantillas.archivo_mime is
  'MIME del archivo de formato.';

insert into storage.buckets (id, name, public)
values ('legal-plantillas', 'legal-plantillas', false)
on conflict (id) do nothing;

drop policy if exists legal_plantillas_storage_select on storage.objects;
create policy legal_plantillas_storage_select
  on storage.objects for select to authenticated
  using (bucket_id = 'legal-plantillas');

drop policy if exists legal_plantillas_storage_insert on storage.objects;
create policy legal_plantillas_storage_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'legal-plantillas');

drop policy if exists legal_plantillas_storage_update on storage.objects;
create policy legal_plantillas_storage_update
  on storage.objects for update to authenticated
  using (bucket_id = 'legal-plantillas');

drop policy if exists legal_plantillas_storage_delete on storage.objects;
create policy legal_plantillas_storage_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'legal-plantillas');

grant select, insert, update, delete on public.ci_legal_plantillas to service_role;

notify pgrst, 'reload schema';
