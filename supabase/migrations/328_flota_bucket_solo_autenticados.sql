-- Flota: crea el bucket `flota` (no existe en la base) con políticas solo para
-- usuarios autenticados. Sin políticas anónimas.
-- Lectura pública: el módulo muestra facturas, documentos y manuales por URL pública
-- (getPublicUrl en lib/flota/acceso.ts), así que el bucket queda público solo para SELECT.
-- Las subidas, modificaciones y borrados requieren sesión (lib/flota/acceso.ts → subirArchivoFlota).

begin;

insert into storage.buckets (id, name, public)
values ('flota', 'flota', true)
on conflict (id) do update set public = true;

drop policy if exists "flota select public" on storage.objects;
create policy "flota select public"
  on storage.objects for select
  using (bucket_id = 'flota');

drop policy if exists "flota insert authenticated" on storage.objects;
create policy "flota insert authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'flota');

drop policy if exists "flota update authenticated" on storage.objects;
create policy "flota update authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'flota')
  with check (bucket_id = 'flota');

drop policy if exists "flota delete authenticated" on storage.objects;
create policy "flota delete authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'flota');

-- Sin política para anon: la inserción anónima queda cerrada.

commit;
