-- Bucket publico para media del modulo ci_proyectos (fotos, planos, visitas).

insert into storage.buckets (id, name, public)
values ('ci-proyectos-media', 'ci-proyectos-media', true)
on conflict (id) do update set public = true;

drop policy if exists "ci-proyectos-media select public" on storage.objects;
create policy "ci-proyectos-media select public"
  on storage.objects for select
  using (bucket_id = 'ci-proyectos-media');

drop policy if exists "ci-proyectos-media insert anon" on storage.objects;
create policy "ci-proyectos-media insert anon"
  on storage.objects for insert to anon
  with check (bucket_id = 'ci-proyectos-media');

drop policy if exists "ci-proyectos-media update anon" on storage.objects;
create policy "ci-proyectos-media update anon"
  on storage.objects for update to anon
  using (bucket_id = 'ci-proyectos-media')
  with check (bucket_id = 'ci-proyectos-media');

drop policy if exists "ci-proyectos-media delete anon" on storage.objects;
create policy "ci-proyectos-media delete anon"
  on storage.objects for delete to anon
  using (bucket_id = 'ci-proyectos-media');

drop policy if exists "ci-proyectos-media insert authenticated" on storage.objects;
create policy "ci-proyectos-media insert authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ci-proyectos-media');

drop policy if exists "ci-proyectos-media update authenticated" on storage.objects;
create policy "ci-proyectos-media update authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'ci-proyectos-media')
  with check (bucket_id = 'ci-proyectos-media');

drop policy if exists "ci-proyectos-media delete authenticated" on storage.objects;
create policy "ci-proyectos-media delete authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'ci-proyectos-media');
