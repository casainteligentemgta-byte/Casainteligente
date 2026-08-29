-- Campos de conductor alineados al servicio tipado (nombre completo y vencimientos).

alter table public.ci_flota_conductores
  add column if not exists nombre_completo text,
  add column if not exists numero_cedula text,
  add column if not exists fecha_vencimiento_licencia date,
  add column if not exists fecha_vencimiento_salud date;

update public.ci_flota_conductores
set
  nombre_completo = nullif(btrim(concat_ws(' ', nombres, apellidos)), ''),
  numero_cedula = coalesce(nullif(btrim(numero_cedula), ''), nullif(btrim(cedula), '')),
  fecha_vencimiento_licencia = coalesce(fecha_vencimiento_licencia, licencia_vence),
  fecha_vencimiento_salud = coalesce(fecha_vencimiento_salud, certificado_medico_vence)
where
  nombre_completo is null
  or fecha_vencimiento_licencia is null
  or fecha_vencimiento_salud is null
  or numero_cedula is null;

comment on column public.ci_flota_conductores.nombre_completo is
  'Nombre y apellidos en un solo campo (API crearConductor).';
comment on column public.ci_flota_conductores.numero_cedula is
  'Cédula normalizada; se sincroniza con cedula.';
comment on column public.ci_flota_conductores.fecha_vencimiento_licencia is
  'Vence licencia INTT; se sincroniza con licencia_vence.';
comment on column public.ci_flota_conductores.fecha_vencimiento_salud is
  'Vence certificado médico; se sincroniza con certificado_medico_vence.';

create index if not exists idx_ci_flota_conductores_entidad_created
  on public.ci_flota_conductores (entidad_id, created_at desc);

notify pgrst, 'reload schema';
