-- PDF planilla captación automática (privado; acceso vía signed URL o servicio).

insert into storage.buckets (id, name, public)
values ('contratos_obreros', 'contratos_obreros', false)
on conflict (id) do nothing;

drop policy if exists "contratos_obreros_select_anon" on storage.objects;
drop policy if exists "contratos_obreros_insert_anon" on storage.objects;
drop policy if exists "contratos_obreros_select_auth" on storage.objects;
drop policy if exists "contratos_obreros_insert_auth" on storage.objects;
drop policy if exists "contratos_obreros_select_service" on storage.objects;
drop policy if exists "contratos_obreros_insert_service" on storage.objects;

create policy "contratos_obreros_select_anon"
on storage.objects for select to anon
using (bucket_id = 'contratos_obreros');

create policy "contratos_obreros_insert_anon"
on storage.objects for insert to anon
with check (bucket_id = 'contratos_obreros');

create policy "contratos_obreros_select_auth"
on storage.objects for select to authenticated
using (bucket_id = 'contratos_obreros');

create policy "contratos_obreros_insert_auth"
on storage.objects for insert to authenticated
with check (bucket_id = 'contratos_obreros');

notify pgrst, 'reload schema';
