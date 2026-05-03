-- Bucket público para contratos/documentos de talento
insert into storage.buckets (id, name, public)
values ('ci-talento-media', 'ci-talento-media', true)
on conflict (id) do nothing;

drop policy if exists "ci_talento_media_select_anon" on storage.objects;
drop policy if exists "ci_talento_media_insert_anon" on storage.objects;
drop policy if exists "ci_talento_media_update_anon" on storage.objects;
drop policy if exists "ci_talento_media_delete_anon" on storage.objects;
drop policy if exists "ci_talento_media_select_auth" on storage.objects;
drop policy if exists "ci_talento_media_insert_auth" on storage.objects;
drop policy if exists "ci_talento_media_update_auth" on storage.objects;
drop policy if exists "ci_talento_media_delete_auth" on storage.objects;

create policy "ci_talento_media_select_anon"
on storage.objects for select
to anon
using (bucket_id = 'ci-talento-media');

create policy "ci_talento_media_insert_anon"
on storage.objects for insert
to anon
with check (bucket_id = 'ci-talento-media');

create policy "ci_talento_media_update_anon"
on storage.objects for update
to anon
using (bucket_id = 'ci-talento-media')
with check (bucket_id = 'ci-talento-media');

create policy "ci_talento_media_delete_anon"
on storage.objects for delete
to anon
using (bucket_id = 'ci-talento-media');

create policy "ci_talento_media_select_auth"
on storage.objects for select
to authenticated
using (bucket_id = 'ci-talento-media');

create policy "ci_talento_media_insert_auth"
on storage.objects for insert
to authenticated
with check (bucket_id = 'ci-talento-media');

create policy "ci_talento_media_update_auth"
on storage.objects for update
to authenticated
using (bucket_id = 'ci-talento-media')
with check (bucket_id = 'ci-talento-media');

create policy "ci_talento_media_delete_auth"
on storage.objects for delete
to authenticated
using (bucket_id = 'ci-talento-media');
