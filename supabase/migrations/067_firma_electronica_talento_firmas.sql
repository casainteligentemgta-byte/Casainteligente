-- Firma electrónica (planilla LOTTT / Gaceta): columnas en ci_empleados + bucket talento-firmas (lectura pública para embeber en PDF).

alter table public.ci_empleados
  add column if not exists firma_electronica_url text,
  add column if not exists firma_electronica_id uuid,
  add column if not exists firma_electronica_at timestamptz;

comment on column public.ci_empleados.firma_electronica_url is
  'URL pública (Storage talento-firmas) de la imagen PNG de la firma capturada.';
comment on column public.ci_empleados.firma_electronica_id is
  'UUID de evento de captura (trazabilidad en PDF y auditoría).';
comment on column public.ci_empleados.firma_electronica_at is
  'Marca de tiempo ISO de cuando se guardó la firma electrónica.';

insert into storage.buckets (id, name, public)
values ('talento-firmas', 'talento-firmas', true)
on conflict (id) do nothing;

drop policy if exists "talento_firmas_select_anon" on storage.objects;
drop policy if exists "talento_firmas_select_auth" on storage.objects;

create policy "talento_firmas_select_anon"
on storage.objects for select to anon
using (bucket_id = 'talento-firmas');

create policy "talento_firmas_select_auth"
on storage.objects for select to authenticated
using (bucket_id = 'talento-firmas');

-- Inserción/actualización solo vía service role (API servidor), sin políticas insert anon.
