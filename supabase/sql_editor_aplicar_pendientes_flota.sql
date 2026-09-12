-- Paquete para SQL Editor de producción (idempotente).
-- 1) Opcional: listar lo ya aplicado:
--    select version, name from supabase_migrations.schema_migrations order by version;
-- 2) Ejecutar este archivo completo.
-- 3) Al final registra versiones y recarga PostgREST.

-- ========== 0311_noop_preview_history.sql ==========
-- No-op: versión huérfana del Preview Branch tras renombres temporales.
select 1;

-- ========== 0312_ensure_recruitment_needs.sql ==========
-- Asegura recruitment_needs antes de 032_* cuando Preview ya tiene
-- schema_migrations.version=031 aplicada con otro archivo histórico
-- (p. ej. solo ci_preguntas) y se omite 031_recruitment_needs.sql.

create table if not exists public.recruitment_needs (
  id uuid primary key default gen_random_uuid() not null,
  title text not null,
  notes text,
  protocol_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_recruitment_needs_created_at
  on public.recruitment_needs (created_at desc);

alter table public.recruitment_needs enable row level security;

-- Banco de preguntas (contenido que convivía en el antiguo 031_ci_preguntas).
create table if not exists public.ci_preguntas (
  id uuid primary key default gen_random_uuid(),
  tipo_vacante text not null,
  categoria text not null,
  pregunta text not null,
  opciones jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_preguntas_tipo on public.ci_preguntas (tipo_vacante);
create index if not exists idx_ci_preguntas_tipo_cat on public.ci_preguntas (tipo_vacante, categoria);

alter table public.ci_preguntas enable row level security;

-- ========== 090_ci_empleados_observaciones_rrhh.sql ==========
-- Observaciones internas de RRHH por obrero (visible en /rrhh/hojas-vida).
-- Idempotente.

alter table public.ci_empleados
  add column if not exists observaciones_rrhh text;

comment on column public.ci_empleados.observaciones_rrhh is
  'Notas internas de RRHH para seguimiento del expediente del trabajador.';

notify pgrst, 'reload schema';
--

-- ========== 1980_ensure_empresas.sql ==========
-- Asegura public.empresas en Preview/bases donde 004/008 no se reaplican
-- (branching con historial del padre ya marcado como applied).

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  telefono text,
  email text,
  rif text,
  notas text,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

alter table public.empresas add column if not exists rif text;
alter table public.empresas add column if not exists notas text;

create index if not exists idx_empresas_nombre on public.empresas (nombre);

alter table public.empresas enable row level security;

-- ========== 313_ci_flota.sql ==========
-- Módulo Flota: vehículos, conductores, gasolina, mantenimiento, alertas y manuales del mecánico.

create table if not exists public.ci_flota_vehiculos (
  id uuid primary key default gen_random_uuid(),
  entidad_id uuid references public.ci_entidades (id) on delete set null,
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  placa text not null,
  marca text,
  modelo text,
  anio integer,
  tipo text not null default 'camioneta'
    check (tipo in ('auto', 'camioneta', 'camion', 'moto', 'maquinaria', 'otro')),
  color text,
  odometro_km numeric(12, 1) not null default 0 check (odometro_km >= 0),
  capacidad_tanque_litros numeric(8, 2) check (capacidad_tanque_litros is null or capacidad_tanque_litros > 0),
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ci_flota_vehiculos_placa_unique
  on public.ci_flota_vehiculos (upper(btrim(placa)));

create index if not exists idx_ci_flota_vehiculos_entidad
  on public.ci_flota_vehiculos (entidad_id);

create index if not exists idx_ci_flota_vehiculos_proyecto
  on public.ci_flota_vehiculos (proyecto_id);

create index if not exists idx_ci_flota_vehiculos_activo
  on public.ci_flota_vehiculos (activo);

comment on table public.ci_flota_vehiculos is
  'Unidades de la flota (placa venezolana, odómetro y asignación a entidad/obra).';

create table if not exists public.ci_flota_conductores (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid,
  entidad_id uuid references public.ci_entidades (id) on delete set null,
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  vehiculo_asignado_id uuid references public.ci_flota_vehiculos (id) on delete set null,
  nombre_completo text,
  nombres text not null,
  apellidos text not null,
  cedula text,
  numero_cedula text,
  telefono text,
  email text,
  tipo_licencia text,
  licencia_numero text,
  fecha_vencimiento_licencia date,
  fecha_vencimiento_salud date,
  licencia_vence date,
  certificado_medico_vence date,
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_flota_conductores_vehiculo
  on public.ci_flota_conductores (vehiculo_asignado_id);

create index if not exists idx_ci_flota_conductores_entidad
  on public.ci_flota_conductores (entidad_id);

create index if not exists idx_ci_flota_conductores_activo
  on public.ci_flota_conductores (activo);

create unique index if not exists ci_flota_conductores_cedula_unique
  on public.ci_flota_conductores (btrim(cedula))
  where cedula is not null and btrim(cedula) <> '';

comment on table public.ci_flota_conductores is
  'Conductores de flota: licencia, certificado médico y vehículo asignado.';

create table if not exists public.ci_flota_conductor_documentos (
  id uuid primary key default gen_random_uuid(),
  conductor_id uuid not null references public.ci_flota_conductores (id) on delete cascade,
  tipo text not null default 'otro'
    check (tipo in ('licencia', 'certificado_medico', 'cedula', 'seguro', 'otro')),
  nombre text not null,
  url text,
  vence_el date,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_flota_conductor_docs_conductor
  on public.ci_flota_conductor_documentos (conductor_id, vence_el);

comment on table public.ci_flota_conductor_documentos is
  'Documentos del conductor (licencia, certificado, cédula) con vencimiento.';

create table if not exists public.ci_flota_gasolina (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references public.ci_flota_vehiculos (id) on delete restrict,
  conductor_id uuid references public.ci_flota_conductores (id) on delete set null,
  entidad_id uuid references public.ci_entidades (id) on delete set null,
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  fecha date not null default current_date,
  litros numeric(10, 2) not null check (litros > 0),
  odometro_km numeric(12, 1) check (odometro_km is null or odometro_km >= 0),
  precio_litro_usd numeric(12, 4) check (precio_litro_usd is null or precio_litro_usd >= 0),
  precio_litro_bs numeric(16, 4) check (precio_litro_bs is null or precio_litro_bs >= 0),
  monto_usd numeric(14, 2) check (monto_usd is null or monto_usd >= 0),
  monto_bs numeric(16, 2) check (monto_bs is null or monto_bs >= 0),
  estacion text,
  factura_url text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_flota_gasolina_vehiculo_fecha
  on public.ci_flota_gasolina (vehiculo_id, fecha desc);

create index if not exists idx_ci_flota_gasolina_conductor
  on public.ci_flota_gasolina (conductor_id);

create index if not exists idx_ci_flota_gasolina_proyecto
  on public.ci_flota_gasolina (proyecto_id, fecha desc);

comment on table public.ci_flota_gasolina is
  'Cargas de combustible por unidad (litros, odómetro, Bs/USD).';

create table if not exists public.ci_flota_mantenimiento (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references public.ci_flota_vehiculos (id) on delete restrict,
  fecha date not null default current_date,
  tipo text not null default 'preventivo'
    check (tipo in (
      'preventivo',
      'correctivo',
      'cambio_aceite',
      'gomas',
      'frenos',
      'revision',
      'otro'
    )),
  descripcion text,
  odometro_km numeric(12, 1) check (odometro_km is null or odometro_km >= 0),
  costo_usd numeric(14, 2) check (costo_usd is null or costo_usd >= 0),
  costo_bs numeric(16, 2) check (costo_bs is null or costo_bs >= 0),
  taller text,
  proximo_odometro_km numeric(12, 1) check (proximo_odometro_km is null or proximo_odometro_km >= 0),
  proximo_fecha date,
  factura_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_flota_mantenimiento_vehiculo_fecha
  on public.ci_flota_mantenimiento (vehiculo_id, fecha desc);

create index if not exists idx_ci_flota_mantenimiento_proximo
  on public.ci_flota_mantenimiento (proximo_fecha)
  where proximo_fecha is not null;

comment on table public.ci_flota_mantenimiento is
  'Servicios de taller y próximo mantenimiento (km o fecha).';

create table if not exists public.ci_flota_alertas_config (
  id uuid primary key default gen_random_uuid(),
  tipo text not null
    check (tipo in (
      'licencia_vence',
      'certificado_vence',
      'documento_vence',
      'mantenimiento_fecha',
      'mantenimiento_km',
      'consumo_alto'
    )),
  dias_anticipacion integer not null default 15 check (dias_anticipacion >= 0),
  umbral_consumo_km_l numeric(8, 2) check (umbral_consumo_km_l is null or umbral_consumo_km_l > 0),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_flota_alertas_config_tipo_unique unique (tipo)
);

comment on table public.ci_flota_alertas_config is
  'Umbrales para generar alertas de flota (vencimientos, km y consumo).';

create table if not exists public.ci_flota_alertas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  severidad text not null default 'warning'
    check (severidad in ('info', 'warning', 'critica')),
  titulo text not null,
  mensaje text,
  conductor_id uuid references public.ci_flota_conductores (id) on delete cascade,
  vehiculo_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  referencia_id uuid,
  vence_el date,
  leida boolean not null default false,
  resuelta boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CREATE TABLE IF NOT EXISTS no añade columnas si la tabla ya existía
-- (p. ej. esquema maquinaria con estado y sin leida/resuelta).
alter table public.ci_flota_alertas
  add column if not exists tipo text,
  add column if not exists severidad text default 'warning',
  add column if not exists titulo text,
  add column if not exists mensaje text,
  add column if not exists conductor_id uuid references public.ci_flota_conductores (id) on delete cascade,
  add column if not exists vehiculo_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists referencia_id uuid,
  add column if not exists vence_el date,
  add column if not exists leida boolean not null default false,
  add column if not exists resuelta boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas' and column_name = 'estado'
  ) then
    update public.ci_flota_alertas
    set
      resuelta = case
        when lower(coalesce(estado, '')) in ('resuelta', 'resuelto') then true
        else resuelta
      end,
      leida = case
        when lower(coalesce(estado, '')) in ('leida', 'leido', 'leído', 'resuelta', 'resuelto') then true
        else leida
      end;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas' and column_name = 'detalle'
  ) then
    update public.ci_flota_alertas
    set mensaje = coalesce(mensaje, detalle)
    where mensaje is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ci_flota_alertas' and column_name = 'creada_en'
  ) then
    update public.ci_flota_alertas
    set created_at = creada_en
    where creada_en is not null;
  end if;
end $$;

update public.ci_flota_alertas
set
  titulo = coalesce(nullif(btrim(titulo), ''), nullif(btrim(tipo), ''), 'Alerta'),
  severidad = coalesce(nullif(btrim(severidad), ''), 'warning')
where titulo is null or severidad is null;

create index if not exists idx_ci_flota_alertas_abiertas
  on public.ci_flota_alertas (resuelta, severidad, created_at desc);

create index if not exists idx_ci_flota_alertas_conductor
  on public.ci_flota_alertas (conductor_id);

create index if not exists idx_ci_flota_alertas_vehiculo
  on public.ci_flota_alertas (vehiculo_id);

comment on table public.ci_flota_alertas is
  'Alertas generadas: licencias, mantenimiento y consumo anómalo.';

create table if not exists public.ci_flota_manuales (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  vehiculo_marca text,
  vehiculo_modelo text,
  archivo_url text,
  archivo_nombre text,
  texto_extraido text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_flota_manuales_marca
  on public.ci_flota_manuales (vehiculo_marca, vehiculo_modelo);

comment on table public.ci_flota_manuales is
  'Manuales técnicos cargados para el chatbot mecánico.';

create table if not exists public.ci_flota_manual_chunks (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.ci_flota_manuales (id) on delete cascade,
  chunk_index integer not null default 0,
  contenido text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_flota_manual_chunks_manual
  on public.ci_flota_manual_chunks (manual_id, chunk_index);

create index if not exists idx_ci_flota_manual_chunks_fts
  on public.ci_flota_manual_chunks
  using gin (to_tsvector('spanish', contenido));

comment on table public.ci_flota_manual_chunks is
  'Fragmentos de manuales para buscar contexto del mecánico.';

insert into public.ci_flota_alertas_config (tipo, dias_anticipacion, umbral_consumo_km_l, activa)
values
  ('licencia_vence', 15, null, true),
  ('certificado_vence', 15, null, true),
  ('documento_vence', 15, null, true),
  ('mantenimiento_fecha', 7, null, true),
  ('mantenimiento_km', 0, null, true),
  ('consumo_alto', 0, 4.0, true)
on conflict (tipo) do nothing;

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

drop policy if exists "flota insert anon" on storage.objects;
create policy "flota insert anon"
  on storage.objects for insert to anon
  with check (bucket_id = 'flota');

alter table public.ci_flota_vehiculos enable row level security;
alter table public.ci_flota_conductores enable row level security;
alter table public.ci_flota_conductor_documentos enable row level security;
alter table public.ci_flota_gasolina enable row level security;
alter table public.ci_flota_mantenimiento enable row level security;
alter table public.ci_flota_alertas_config enable row level security;
alter table public.ci_flota_alertas enable row level security;
alter table public.ci_flota_manuales enable row level security;
alter table public.ci_flota_manual_chunks enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ci_flota_vehiculos',
    'ci_flota_conductores',
    'ci_flota_conductor_documentos',
    'ci_flota_gasolina',
    'ci_flota_mantenimiento',
    'ci_flota_alertas_config',
    'ci_flota_alertas',
    'ci_flota_manuales',
    'ci_flota_manual_chunks'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_auth', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select_auth',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_insert_auth', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (true)',
      t || '_insert_auth',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_update_auth', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (true) with check (true)',
      t || '_update_auth',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_delete_auth', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (true)',
      t || '_delete_auth',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_all_service', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      t || '_all_service',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ========== 314_ci_flota_conductores_nombre_completo.sql ==========
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

-- ========== 315_ci_flota_gasolina_maquinaria.sql ==========
-- Gasolina: campos de la API registrarGasolina (maquinaria_id, litros, km, created_by).

alter table public.ci_flota_gasolina
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete restrict,
  add column if not exists cantidad_litros numeric(10, 2),
  add column if not exists costo_total numeric(14, 2),
  add column if not exists km_actual numeric(12, 1),
  add column if not exists tipo_gasolina text,
  add column if not exists estacion_gasolina text,
  add column if not exists created_by uuid;

update public.ci_flota_gasolina
set
  maquinaria_id = coalesce(maquinaria_id, vehiculo_id),
  cantidad_litros = coalesce(cantidad_litros, litros),
  costo_total = coalesce(costo_total, monto_usd),
  km_actual = coalesce(km_actual, odometro_km),
  estacion_gasolina = coalesce(nullif(btrim(estacion_gasolina), ''), estacion);

create index if not exists idx_ci_flota_gasolina_maquinaria
  on public.ci_flota_gasolina (maquinaria_id, created_at desc);

comment on column public.ci_flota_gasolina.maquinaria_id is
  'Unidad / maquinaria (alias de vehiculo_id para la API).';
comment on column public.ci_flota_gasolina.cantidad_litros is
  'Litros cargados; se sincroniza con litros.';
comment on column public.ci_flota_gasolina.km_actual is
  'Odómetro al cargar; se sincroniza con odometro_km.';
comment on column public.ci_flota_gasolina.created_by is
  'Usuario auth que registró la carga.';

notify pgrst, 'reload schema';

-- ========== 316_ci_flota_mantenimiento_maquinaria.sql ==========
-- Mantenimiento: campos de la API registrarMantenimiento.

alter table public.ci_flota_mantenimiento
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete restrict,
  add column if not exists tipo_mantenimiento text,
  add column if not exists km_actual numeric(12, 1),
  add column if not exists taller_nombre text,
  add column if not exists costo numeric(14, 2),
  add column if not exists fecha_mantenimiento date,
  add column if not exists proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  add column if not exists created_by uuid;

update public.ci_flota_mantenimiento
set
  maquinaria_id = coalesce(maquinaria_id, vehiculo_id),
  tipo_mantenimiento = coalesce(nullif(btrim(tipo_mantenimiento), ''), tipo),
  km_actual = coalesce(km_actual, odometro_km),
  taller_nombre = coalesce(nullif(btrim(taller_nombre), ''), taller),
  costo = coalesce(costo, costo_usd),
  fecha_mantenimiento = coalesce(fecha_mantenimiento, fecha);

create index if not exists idx_ci_flota_mantenimiento_maquinaria
  on public.ci_flota_mantenimiento (maquinaria_id, fecha_mantenimiento desc);

comment on column public.ci_flota_mantenimiento.maquinaria_id is
  'Unidad / maquinaria (alias de vehiculo_id para la API).';
comment on column public.ci_flota_mantenimiento.tipo_mantenimiento is
  'Tipo de servicio; se sincroniza con tipo.';
comment on column public.ci_flota_mantenimiento.fecha_mantenimiento is
  'Fecha del servicio; se sincroniza con fecha.';
comment on column public.ci_flota_mantenimiento.created_by is
  'Usuario auth que registró el servicio.';

notify pgrst, 'reload schema';

-- ========== 317_ci_flota_alertas_maquinaria.sql ==========
-- Alertas: config por maquinaria (km/días) y alertas con estado/creada_en.

alter table public.ci_flota_alertas_config
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists tipo_alerta text,
  add column if not exists frecuencia_tipo text
    check (frecuencia_tipo is null or frecuencia_tipo in ('km', 'dias')),
  add column if not exists frecuencia_valor numeric(12, 1)
    check (frecuencia_valor is null or frecuencia_valor >= 0),
  add column if not exists proxima_alerta_km numeric(12, 1),
  add column if not exists proxima_alerta_fecha date;

alter table public.ci_flota_alertas_config
  drop constraint if exists ci_flota_alertas_config_tipo_unique;

create unique index if not exists ci_flota_alertas_config_tipo_global
  on public.ci_flota_alertas_config (tipo)
  where maquinaria_id is null;

create unique index if not exists ci_flota_alertas_config_maq_tipo
  on public.ci_flota_alertas_config (maquinaria_id, tipo_alerta)
  where maquinaria_id is not null;

update public.ci_flota_alertas_config
set
  tipo_alerta = coalesce(nullif(btrim(tipo_alerta), ''), tipo),
  frecuencia_tipo = coalesce(
    frecuencia_tipo,
    case when tipo = 'mantenimiento_km' then 'km' else 'dias' end
  ),
  frecuencia_valor = coalesce(frecuencia_valor, dias_anticipacion);

alter table public.ci_flota_alertas
  add column if not exists tipo text,
  add column if not exists titulo text,
  add column if not exists mensaje text,
  add column if not exists vehiculo_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists vence_el date,
  add column if not exists leida boolean not null default false,
  add column if not exists resuelta boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists config_id uuid references public.ci_flota_alertas_config (id) on delete set null,
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists tipo_alerta text,
  add column if not exists descripcion text,
  add column if not exists fecha_vencimiento date,
  add column if not exists km_vencimiento numeric(12, 1),
  add column if not exists estado text not null default 'pendiente'
    check (estado in ('pendiente', 'leida', 'resuelta')),
  add column if not exists creada_en timestamptz;

update public.ci_flota_alertas
set
  maquinaria_id = coalesce(maquinaria_id, vehiculo_id),
  tipo_alerta = coalesce(nullif(btrim(tipo_alerta), ''), tipo),
  descripcion = coalesce(descripcion, mensaje),
  fecha_vencimiento = coalesce(fecha_vencimiento, vence_el),
  creada_en = coalesce(creada_en, created_at),
  estado = case
    when resuelta then 'resuelta'
    when leida then 'leida'
    when lower(coalesce(estado, '')) in ('abierta', 'abierto', 'nueva', 'nuevo') then 'pendiente'
    else coalesce(nullif(btrim(estado), ''), 'pendiente')
  end,
  resuelta = case
    when resuelta then true
    when lower(coalesce(estado, '')) in ('resuelta', 'resuelto') then true
    else false
  end,
  leida = case
    when leida or resuelta then true
    when lower(coalesce(estado, '')) in ('leida', 'leido', 'leído', 'resuelta', 'resuelto') then true
    else false
  end;

alter table public.ci_flota_alertas
  alter column creada_en set default now();

update public.ci_flota_alertas
set creada_en = created_at
where creada_en is null;

alter table public.ci_flota_alertas
  alter column creada_en set not null;

create index if not exists idx_ci_flota_alertas_pendientes
  on public.ci_flota_alertas (estado, creada_en desc)
  where estado = 'pendiente';

create index if not exists idx_ci_flota_alertas_maquinaria
  on public.ci_flota_alertas (maquinaria_id, creada_en desc);

create index if not exists idx_ci_flota_alertas_config_maq
  on public.ci_flota_alertas_config (maquinaria_id, tipo_alerta);

comment on column public.ci_flota_alertas_config.maquinaria_id is
  'Unidad de la regla (null = umbral global del módulo).';
comment on column public.ci_flota_alertas.estado is
  'pendiente | leida | resuelta; se sincroniza con leida/resuelta.';
comment on column public.ci_flota_alertas.creada_en is
  'Fecha de generación; alias de created_at para la API.';

notify pgrst, 'reload schema';

-- ========== 318_budgets_abonos_cuotas.sql ==========
-- Abonos libres y cuotas planificadas sobre presupuestos comerciales (budgets).

alter table public.budgets
  add column if not exists monto_pagado numeric(14, 2) not null default 0
    check (monto_pagado >= 0),
  add column if not exists saldo numeric(14, 2);

update public.budgets
set
  monto_pagado = case when status = 'pagado' then coalesce(subtotal, 0) else coalesce(monto_pagado, 0) end,
  saldo = greatest(coalesce(subtotal, 0) - case when status = 'pagado' then coalesce(subtotal, 0) else coalesce(monto_pagado, 0) end, 0);

alter table public.budgets
  drop constraint if exists budgets_status_check;

alter table public.budgets
  add constraint budgets_status_check
  check (status in (
    'no_enviado',
    'enviado',
    'aprobado',
    'no_aprobado',
    'cobrado',
    'parcialmente_pagado',
    'pagado'
  ));

create table if not exists public.budget_cuotas (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  numero integer not null check (numero >= 1),
  monto numeric(14, 2) not null check (monto > 0),
  fecha_vencimiento date not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'parcial', 'pagada')),
  monto_pagado numeric(14, 2) not null default 0 check (monto_pagado >= 0),
  notas text,
  created_at timestamptz not null default now(),
  unique (budget_id, numero)
);

create index if not exists idx_budget_cuotas_budget
  on public.budget_cuotas (budget_id, fecha_vencimiento, numero);

create table if not exists public.budget_abonos (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  cuota_id uuid references public.budget_cuotas (id) on delete set null,
  monto numeric(14, 2) not null check (monto > 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'VES')),
  monto_usd numeric(14, 2) not null check (monto_usd > 0),
  tasa_bcv numeric(18, 6),
  metodo text not null default 'transferencia',
  banco_origen text,
  referencia text,
  fecha_abono date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_budget_abonos_budget
  on public.budget_abonos (budget_id, fecha_abono desc, created_at desc);

alter table public.budget_cuotas enable row level security;
alter table public.budget_abonos enable row level security;

drop policy if exists "Permitir leer budget_cuotas" on public.budget_cuotas;
create policy "Permitir leer budget_cuotas"
  on public.budget_cuotas for select to anon using (true);
drop policy if exists "Permitir insertar budget_cuotas" on public.budget_cuotas;
create policy "Permitir insertar budget_cuotas"
  on public.budget_cuotas for insert to anon with check (true);
drop policy if exists "Permitir actualizar budget_cuotas" on public.budget_cuotas;
create policy "Permitir actualizar budget_cuotas"
  on public.budget_cuotas for update to anon using (true) with check (true);
drop policy if exists "Permitir borrar budget_cuotas" on public.budget_cuotas;
create policy "Permitir borrar budget_cuotas"
  on public.budget_cuotas for delete to anon using (true);

drop policy if exists "Permitir leer budget_abonos" on public.budget_abonos;
create policy "Permitir leer budget_abonos"
  on public.budget_abonos for select to anon using (true);
drop policy if exists "Permitir insertar budget_abonos" on public.budget_abonos;
create policy "Permitir insertar budget_abonos"
  on public.budget_abonos for insert to anon with check (true);
drop policy if exists "Permitir actualizar budget_abonos" on public.budget_abonos;
create policy "Permitir actualizar budget_abonos"
  on public.budget_abonos for update to anon using (true) with check (true);
drop policy if exists "Permitir borrar budget_abonos" on public.budget_abonos;
create policy "Permitir borrar budget_abonos"
  on public.budget_abonos for delete to anon using (true);

drop policy if exists "Permitir leer budget_cuotas authenticated" on public.budget_cuotas;
create policy "Permitir leer budget_cuotas authenticated"
  on public.budget_cuotas for select to authenticated using (true);
drop policy if exists "Permitir escribir budget_cuotas authenticated" on public.budget_cuotas;
create policy "Permitir escribir budget_cuotas authenticated"
  on public.budget_cuotas for all to authenticated using (true) with check (true);

drop policy if exists "Permitir leer budget_abonos authenticated" on public.budget_abonos;
create policy "Permitir leer budget_abonos authenticated"
  on public.budget_abonos for select to authenticated using (true);
drop policy if exists "Permitir escribir budget_abonos authenticated" on public.budget_abonos;
create policy "Permitir escribir budget_abonos authenticated"
  on public.budget_abonos for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.budget_cuotas to anon, authenticated, service_role;
grant select, insert, update, delete on public.budget_abonos to anon, authenticated, service_role;

create or replace function public.ci_recalcular_cobro_presupuesto(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(14, 2);
  v_pagado numeric(14, 2);
  v_saldo numeric(14, 2);
  v_status text;
begin
  select coalesce(subtotal, 0), status into v_total, v_status
  from public.budgets
  where id = p_budget_id
  for update;

  if not found then
    raise exception 'Presupuesto no encontrado';
  end if;

  select coalesce(sum(monto_usd), 0) into v_pagado
  from public.budget_abonos
  where budget_id = p_budget_id;

  v_pagado := round(v_pagado, 2);
  v_saldo := greatest(round(v_total - v_pagado, 2), 0);

  if v_pagado <= 0 then
    if v_status in ('pagado', 'parcialmente_pagado') then
      v_status := 'cobrado';
    end if;
  elsif v_pagado + 0.009 >= v_total and v_total > 0 then
    v_status := 'pagado';
  else
    v_status := 'parcialmente_pagado';
  end if;

  update public.budgets
  set
    monto_pagado = v_pagado,
    saldo = v_saldo,
    status = v_status,
    updated_at = now()
  where id = p_budget_id;

  update public.budget_cuotas c
  set estado = case
    when c.monto_pagado + 0.009 >= c.monto then 'pagada'
    when c.monto_pagado > 0 then 'parcial'
    else 'pendiente'
  end
  where c.budget_id = p_budget_id;
end;
$$;

create or replace function public.ci_aplicar_abono_a_cuotas(
  p_budget_id uuid,
  p_monto_usd numeric,
  p_cuota_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restante numeric(14, 2);
  v_cuota record;
  v_aplicar numeric(14, 2);
  v_falta numeric(14, 2);
begin
  v_restante := round(coalesce(p_monto_usd, 0), 2);
  if v_restante <= 0 then
    return;
  end if;

  if p_cuota_id is not null then
    select * into v_cuota
    from public.budget_cuotas
    where id = p_cuota_id and budget_id = p_budget_id
    for update;
    if found then
      v_falta := greatest(round(v_cuota.monto - v_cuota.monto_pagado, 2), 0);
      v_aplicar := least(v_restante, v_falta);
      if v_aplicar > 0 then
        update public.budget_cuotas
        set monto_pagado = round(monto_pagado + v_aplicar, 2)
        where id = v_cuota.id;
      end if;
    end if;
    return;
  end if;

  for v_cuota in
    select *
    from public.budget_cuotas
    where budget_id = p_budget_id
      and monto_pagado + 0.009 < monto
    order by fecha_vencimiento, numero
    for update
  loop
    exit when v_restante <= 0;
    v_falta := greatest(round(v_cuota.monto - v_cuota.monto_pagado, 2), 0);
    v_aplicar := least(v_restante, v_falta);
    if v_aplicar > 0 then
      update public.budget_cuotas
      set monto_pagado = round(monto_pagado + v_aplicar, 2)
      where id = v_cuota.id;
      v_restante := round(v_restante - v_aplicar, 2);
    end if;
  end loop;
end;
$$;

create or replace function public.ci_registrar_abono_presupuesto(
  p_budget_id uuid,
  p_monto numeric,
  p_moneda text,
  p_monto_usd numeric,
  p_tasa_bcv numeric,
  p_metodo text,
  p_banco_origen text,
  p_referencia text,
  p_fecha_abono date,
  p_notas text default null,
  p_cuota_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_total numeric(14, 2);
  v_pagado numeric(14, 2);
  v_usd numeric(14, 2);
begin
  if p_monto is null or p_monto <= 0 or p_monto_usd is null or p_monto_usd <= 0 then
    raise exception 'El monto del abono debe ser positivo';
  end if;
  if p_moneda not in ('USD', 'VES') then
    raise exception 'Moneda inválida';
  end if;

  select coalesce(subtotal, 0) into v_total
  from public.budgets
  where id = p_budget_id
  for update;
  if not found then
    raise exception 'Presupuesto no encontrado';
  end if;

  select coalesce(sum(monto_usd), 0) into v_pagado
  from public.budget_abonos
  where budget_id = p_budget_id;

  v_usd := round(p_monto_usd, 2);
  if v_pagado + v_usd > v_total + 0.009 then
    raise exception 'El abono supera el saldo (saldo $%)', round(greatest(v_total - v_pagado, 0), 2);
  end if;

  insert into public.budget_abonos (
    budget_id, cuota_id, monto, moneda, monto_usd, tasa_bcv,
    metodo, banco_origen, referencia, fecha_abono, notas
  ) values (
    p_budget_id,
    p_cuota_id,
    round(p_monto, 2),
    p_moneda,
    v_usd,
    p_tasa_bcv,
    coalesce(nullif(trim(p_metodo), ''), 'transferencia'),
    nullif(trim(coalesce(p_banco_origen, '')), ''),
    nullif(trim(coalesce(p_referencia, '')), ''),
    p_fecha_abono,
    nullif(trim(coalesce(p_notas, '')), '')
  )
  returning id into v_id;

  perform public.ci_aplicar_abono_a_cuotas(p_budget_id, v_usd, p_cuota_id);
  perform public.ci_recalcular_cobro_presupuesto(p_budget_id);
  return v_id;
end;
$$;

create or replace function public.ci_eliminar_abono_presupuesto(p_abono_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget uuid;
begin
  select budget_id into v_budget from public.budget_abonos where id = p_abono_id;
  if v_budget is null then
    raise exception 'Abono no encontrado';
  end if;
  delete from public.budget_abonos where id = p_abono_id;
  -- Recalcula cuotas desde cero a partir de los abonos restantes.
  update public.budget_cuotas set monto_pagado = 0 where budget_id = v_budget;
  perform public.ci_aplicar_abono_a_cuotas(
    v_budget,
    coalesce((select sum(monto_usd) from public.budget_abonos where budget_id = v_budget), 0),
    null
  );
  perform public.ci_recalcular_cobro_presupuesto(v_budget);
end;
$$;

grant execute on function public.ci_recalcular_cobro_presupuesto(uuid) to anon, authenticated, service_role;
grant execute on function public.ci_aplicar_abono_a_cuotas(uuid, numeric, uuid) to anon, authenticated, service_role;
grant execute on function public.ci_registrar_abono_presupuesto(uuid, numeric, text, numeric, numeric, text, text, text, date, text, uuid)
  to anon, authenticated, service_role;
grant execute on function public.ci_eliminar_abono_presupuesto(uuid) to anon, authenticated, service_role;

-- Un abono histórico por presupuestos ya marcados como pagados (sin historial).
insert into public.budget_abonos (budget_id, monto, moneda, monto_usd, metodo, fecha_abono, notas)
select
  b.id,
  greatest(coalesce(b.subtotal, 0), 0.01),
  'USD',
  greatest(coalesce(b.subtotal, 0), 0.01),
  'otro',
  coalesce(b.fecha, b.created_at::date, current_date),
  'Abono inicial: presupuesto ya estaba marcado como pagado'
from public.budgets b
where b.status = 'pagado'
  and coalesce(b.subtotal, 0) > 0
  and not exists (select 1 from public.budget_abonos a where a.budget_id = b.id);

do $$
declare
  r record;
begin
  for r in select id from public.budgets where status = 'pagado' loop
    perform public.ci_recalcular_cobro_presupuesto(r.id);
  end loop;
end $$;

comment on table public.budget_abonos is
  'Abonos libres (parciales) del cliente sobre un presupuesto comercial.';
comment on table public.budget_cuotas is
  'Plan de cuotas del presupuesto. Los abonos se aplican FIFO o a una cuota concreta.';
comment on column public.budgets.monto_pagado is
  'Suma de abonos en USD. Se actualiza con ci_recalcular_cobro_presupuesto.';
comment on column public.budgets.saldo is
  'subtotal - monto_pagado (no negativo).';

notify pgrst, 'reload schema';

-- ========== 319_ci_flota_alertas_ensure_resuelta.sql ==========
-- Idempotente: cubre el caso en que 313 ya se registró o la tabla existía
-- sin leida/resuelta.

alter table public.ci_flota_alertas
  add column if not exists tipo text,
  add column if not exists severidad text default 'warning',
  add column if not exists titulo text,
  add column if not exists mensaje text,
  add column if not exists conductor_id uuid references public.ci_flota_conductores (id) on delete cascade,
  add column if not exists vehiculo_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists referencia_id uuid,
  add column if not exists vence_el date,
  add column if not exists leida boolean not null default false,
  add column if not exists resuelta boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists config_id uuid references public.ci_flota_alertas_config (id) on delete set null,
  add column if not exists maquinaria_id uuid references public.ci_flota_vehiculos (id) on delete cascade,
  add column if not exists tipo_alerta text,
  add column if not exists descripcion text,
  add column if not exists fecha_vencimiento date,
  add column if not exists km_vencimiento numeric(12, 1),
  add column if not exists estado text default 'pendiente',
  add column if not exists creada_en timestamptz;

create index if not exists idx_ci_flota_alertas_abiertas
  on public.ci_flota_alertas (resuelta, severidad, created_at desc);

notify pgrst, 'reload schema';

-- Registrar en el historial para que Preview no las vuelva a aplicar.
insert into supabase_migrations.schema_migrations (version, name, statements)
values
  ('0311', '0311_noop_preview_history.sql', array['applied via sql editor']),
  ('0312', '0312_ensure_recruitment_needs.sql', array['applied via sql editor']),
  ('090', '090_ci_empleados_observaciones_rrhh.sql', array['applied via sql editor']),
  ('1980', '1980_ensure_empresas.sql', array['applied via sql editor']),
  ('313', '313_ci_flota.sql', array['applied via sql editor']),
  ('314', '314_ci_flota_conductores_nombre_completo.sql', array['applied via sql editor']),
  ('315', '315_ci_flota_gasolina_maquinaria.sql', array['applied via sql editor']),
  ('316', '316_ci_flota_mantenimiento_maquinaria.sql', array['applied via sql editor']),
  ('317', '317_ci_flota_alertas_maquinaria.sql', array['applied via sql editor']),
  ('318', '318_budgets_abonos_cuotas.sql', array['applied via sql editor']),
  ('319', '319_ci_flota_alertas_ensure_resuelta.sql', array['applied via sql editor'])
on conflict (version) do nothing;

notify pgrst, 'reload schema';

