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
