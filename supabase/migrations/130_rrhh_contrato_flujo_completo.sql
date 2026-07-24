-- Flujo RRHH: generado_pendiente → aceptado_digital → firmado_y_archivado (+ contratado en empleado).

-- Bucket dedicado (rutas proyectos/{proyecto_id}/{cedula}/contrato_*.pdf)
insert into storage.buckets (id, name, public)
values ('contratos', 'contratos', false)
on conflict (id) do update set public = false;

alter table public.ci_contratos_empleado_obra
  add column if not exists token_aceptacion text,
  add column if not exists token_aceptacion_expires_at timestamptz,
  add column if not exists url_contrato_borrador text,
  add column if not exists url_contrato_firmado text,
  add column if not exists storage_path_borrador text,
  add column if not exists storage_path_firmado text,
  add column if not exists aceptado_digital_at timestamptz,
  add column if not exists metadatos_aceptacion jsonb not null default '{}'::jsonb,
  add column if not exists ubicacion_archivo_real text,
  add column if not exists archivado_at timestamptz,
  add column if not exists archivado_por_usuario_id uuid references auth.users (id) on delete set null,
  add column if not exists copia_digital_indexada boolean not null default false,
  add column if not exists whatsapp_enviado_at timestamptz,
  add column if not exists notificacion_rrhh_at timestamptz;

create unique index if not exists idx_ci_contratos_token_aceptacion
  on public.ci_contratos_empleado_obra (token_aceptacion)
  where token_aceptacion is not null and btrim(token_aceptacion) <> '';

comment on column public.ci_contratos_empleado_obra.token_aceptacion is
  'Token opaco para enlace público de aceptación digital (independiente de token_registro del empleado).';
comment on column public.ci_contratos_empleado_obra.estado_contrato is
  'generado_pendiente | aceptado_digital | firmado_y_archivado | (legado: generado, firmado_electronico, firmado_activo).';
comment on column public.ci_contratos_empleado_obra.metadatos_aceptacion is
  'IP, user_agent, geolocalización y trazas de aceptación digital.';
comment on column public.ci_contratos_empleado_obra.ubicacion_archivo_real is
  'Ubicación física del expediente firmado (carpeta, estante, gaveta).';

-- Sincroniza columnas nuevas con datos legados
update public.ci_contratos_empleado_obra c
set
  aceptado_digital_at = coalesce(c.aceptado_digital_at, c.obrero_aceptacion_contrato_at),
  storage_path_borrador = coalesce(c.storage_path_borrador, c.laboral_pdf_storage_path),
  storage_path_firmado = coalesce(c.storage_path_firmado, c.laboral_escaneo_firmado_storage_path),
  metadatos_aceptacion = case
    when c.metadatos_aceptacion = '{}'::jsonb and c.obrero_aceptacion_cliente is not null
    then c.obrero_aceptacion_cliente
    else c.metadatos_aceptacion
  end,
  estado_contrato = case c.estado_contrato
    when 'generado' then 'generado_pendiente'
    when 'firmado_electronico' then 'aceptado_digital'
    when 'firmado_activo' then 'firmado_y_archivado'
    else c.estado_contrato
  end
where c.estado_contrato in ('generado', 'firmado_electronico', 'firmado_activo')
   or c.obrero_aceptacion_contrato_at is not null;

-- Storage: solo service_role y authenticated (signed URLs vía API)
drop policy if exists "contratos_select_auth" on storage.objects;
drop policy if exists "contratos_insert_auth" on storage.objects;
drop policy if exists "contratos_update_auth" on storage.objects;

create policy "contratos_select_auth"
on storage.objects for select to authenticated
using (bucket_id = 'contratos');

create policy "contratos_insert_auth"
on storage.objects for insert to authenticated
with check (bucket_id = 'contratos');

create policy "contratos_update_auth"
on storage.objects for update to authenticated
using (bucket_id = 'contratos')
with check (bucket_id = 'contratos');

-- La aceptación pública del obrero solo debe hacerse vía API (service_role + validación token_aceptacion).
-- Políticas existentes en 025_ci_talento_obras.sql; bucket contratos sin lectura anon.

notify pgrst, 'reload schema';
