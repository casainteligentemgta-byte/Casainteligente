-- Control de jornales de obra + umbrales de desviación presupuestaria.
--
-- Decisión de persistencia: tabla nueva `ci_jornales_obra_asistencias`
-- (no se extiende rrhh_asistencias_diarias, ausente en este repo, ni se reutiliza
-- ci_nomina_obra_periodos/items, que modelan la nómina semanal de pago).
-- Cada fila = un día trabajado con snapshot de costo_jornal (USD).
-- Único por (proyecto_id, empleado_id, fecha). El costo es dato salarial:
-- RLS por entidad con ci_tiene_permiso_en_entidad('equipo.gestionar', …),
-- mismo modelo que salarios en migración 380 / PR 499.

-- ── Marcador de filas demo (schema + seed 383) ─────────────────────
create table if not exists public.ci_seed_demo_filas (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  fila_id uuid not null,
  seed_tag text not null default 'demo_jornales_desviacion_v1',
  created_at timestamptz not null default now(),
  constraint ci_seed_demo_filas_tabla_fila unique (tabla, fila_id)
);

create index if not exists idx_ci_seed_demo_filas_tag
  on public.ci_seed_demo_filas (seed_tag);

comment on table public.ci_seed_demo_filas is
  'Índice de filas de demostración. Limpieza: supabase/sql/cleanup_seed_demo_jornales_desviacion.sql';

alter table public.ci_seed_demo_filas enable row level security;

drop policy if exists ci_seed_demo_filas_select on public.ci_seed_demo_filas;
create policy ci_seed_demo_filas_select on public.ci_seed_demo_filas
  for select to authenticated
  using (true);

revoke all on public.ci_seed_demo_filas from anon;
grant select, insert, update, delete on public.ci_seed_demo_filas to authenticated, service_role;

-- ── Tarifa diaria por colaborador en la obra ───────────────────────
create table if not exists public.ci_jornales_obra_tarifas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  empleado_id uuid not null references public.ci_empleados (id) on delete cascade,
  costo_jornal_usd numeric(12, 4) not null default 0 check (costo_jornal_usd >= 0),
  seed_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint ci_jornales_obra_tarifas_unico unique (proyecto_id, empleado_id)
);

create index if not exists idx_ci_jornales_obra_tarifas_proyecto
  on public.ci_jornales_obra_tarifas (proyecto_id);

comment on table public.ci_jornales_obra_tarifas is
  'Jornal diario (USD) por colaborador asignado a la obra. Dato salarial.';

-- ── Asistencia diaria con costo ────────────────────────────────────
create table if not exists public.ci_jornales_obra_asistencias (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  empleado_id uuid not null references public.ci_empleados (id) on delete cascade,
  fecha date not null,
  costo_jornal numeric(12, 4) not null default 0 check (costo_jornal >= 0),
  horas numeric(6, 2) not null default 8 check (horas >= 0),
  estado text not null default 'presente'
    check (estado in ('presente', 'ausente', 'descanso')),
  origen text not null default 'web'
    check (origen in ('web', 'telegram', 'api', 'seed')),
  seed_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint ci_jornales_obra_asistencias_unico unique (proyecto_id, empleado_id, fecha)
);

create index if not exists idx_ci_jornales_obra_asistencias_proyecto_fecha
  on public.ci_jornales_obra_asistencias (proyecto_id, fecha);

create index if not exists idx_ci_jornales_obra_asistencias_empleado
  on public.ci_jornales_obra_asistencias (empleado_id, fecha);

comment on table public.ci_jornales_obra_asistencias is
  'Día trabajado en obra con snapshot de costo_jornal (USD). Único proyecto+empleado+fecha.';

comment on column public.ci_jornales_obra_asistencias.costo_jornal is
  'Costo del jornal del día en USD. Dato salarial; no exponer sin RLS de entidad.';

-- ── Umbrales de alerta por proyecto ────────────────────────────────
create table if not exists public.ci_proyecto_desviacion_config (
  proyecto_id uuid primary key references public.ci_proyectos (id) on delete cascade,
  umbral_desviacion_pct numeric(6, 2) not null default 15 check (umbral_desviacion_pct >= 0),
  umbral_materiales_pct numeric(6, 2) not null default 15 check (umbral_materiales_pct >= 0),
  umbral_mano_obra_pct numeric(6, 2) not null default 15 check (umbral_mano_obra_pct >= 0),
  limite_jornadas_instalacion integer check (limite_jornadas_instalacion is null or limite_jornadas_instalacion >= 0),
  especialidad_limite text not null default 'Instalador CCTV',
  seed_tag text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

comment on table public.ci_proyecto_desviacion_config is
  'Umbrales de desviación presupuestaria por obra (porcentaje, default 15).';

-- ── Vista invoker: asistencia + colaborador (respeta RLS de las bases) ──
drop view if exists public.ci_v_jornales_obra_asistencias;
create view public.ci_v_jornales_obra_asistencias
with (security_invoker = true) as
select
  a.id,
  a.proyecto_id,
  a.empleado_id,
  a.fecha,
  a.costo_jornal,
  a.horas,
  a.estado,
  a.origen,
  a.seed_tag,
  a.created_at,
  e.nombre_completo,
  e.cargo_nombre,
  e.entidad_id as empleado_entidad_id,
  p.nombre as proyecto_nombre,
  p.entidad_id as proyecto_entidad_id
from public.ci_jornales_obra_asistencias a
join public.ci_empleados e on e.id = a.empleado_id
join public.ci_proyectos p on p.id = a.proyecto_id;

comment on view public.ci_v_jornales_obra_asistencias is
  'Asistencias de jornal con nombre/cargo. security_invoker: aplica RLS de las tablas base.';

-- ── RLS salarial por entidad ───────────────────────────────────────
alter table public.ci_jornales_obra_tarifas enable row level security;
alter table public.ci_jornales_obra_asistencias enable row level security;
alter table public.ci_proyecto_desviacion_config enable row level security;

drop policy if exists ci_jornales_obra_tarifas_select on public.ci_jornales_obra_tarifas;
drop policy if exists ci_jornales_obra_tarifas_insert on public.ci_jornales_obra_tarifas;
drop policy if exists ci_jornales_obra_tarifas_update on public.ci_jornales_obra_tarifas;
drop policy if exists ci_jornales_obra_tarifas_delete on public.ci_jornales_obra_tarifas;

create policy ci_jornales_obra_tarifas_select on public.ci_jornales_obra_tarifas
  for select to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

create policy ci_jornales_obra_tarifas_insert on public.ci_jornales_obra_tarifas
  for insert to authenticated
  with check (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

create policy ci_jornales_obra_tarifas_update on public.ci_jornales_obra_tarifas
  for update to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  )
  with check (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

create policy ci_jornales_obra_tarifas_delete on public.ci_jornales_obra_tarifas
  for delete to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

drop policy if exists ci_jornales_obra_asistencias_select on public.ci_jornales_obra_asistencias;
drop policy if exists ci_jornales_obra_asistencias_insert on public.ci_jornales_obra_asistencias;
drop policy if exists ci_jornales_obra_asistencias_update on public.ci_jornales_obra_asistencias;
drop policy if exists ci_jornales_obra_asistencias_delete on public.ci_jornales_obra_asistencias;

-- Lectura: RRHH/PM (equipo.gestionar) o finanzas (cco.ver) para el costo ejecutado.
-- Escritura más abajo: solo equipo.gestionar (dato salarial).
create policy ci_jornales_obra_asistencias_select on public.ci_jornales_obra_asistencias
  for select to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
    or public.ci_tiene_permiso_en_entidad(
      'cco.ver',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

create policy ci_jornales_obra_asistencias_insert on public.ci_jornales_obra_asistencias
  for insert to authenticated
  with check (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

create policy ci_jornales_obra_asistencias_update on public.ci_jornales_obra_asistencias
  for update to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  )
  with check (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

create policy ci_jornales_obra_asistencias_delete on public.ci_jornales_obra_asistencias
  for delete to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

-- Config de umbrales: equipo.gestionar (incluye PM) o cco.ver (finanzas).
drop policy if exists ci_proyecto_desviacion_config_select on public.ci_proyecto_desviacion_config;
drop policy if exists ci_proyecto_desviacion_config_insert on public.ci_proyecto_desviacion_config;
drop policy if exists ci_proyecto_desviacion_config_update on public.ci_proyecto_desviacion_config;
drop policy if exists ci_proyecto_desviacion_config_delete on public.ci_proyecto_desviacion_config;

create policy ci_proyecto_desviacion_config_select on public.ci_proyecto_desviacion_config
  for select to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
    or public.ci_tiene_permiso_en_entidad(
      'cco.ver',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

create policy ci_proyecto_desviacion_config_insert on public.ci_proyecto_desviacion_config
  for insert to authenticated
  with check (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
    or public.ci_tiene_permiso_en_entidad(
      'cco.editar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

create policy ci_proyecto_desviacion_config_update on public.ci_proyecto_desviacion_config
  for update to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
    or public.ci_tiene_permiso_en_entidad(
      'cco.editar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  )
  with check (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
    or public.ci_tiene_permiso_en_entidad(
      'cco.editar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

create policy ci_proyecto_desviacion_config_delete on public.ci_proyecto_desviacion_config
  for delete to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'equipo.gestionar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
    or public.ci_tiene_permiso_en_entidad(
      'cco.editar',
      (select p.entidad_id from public.ci_proyectos p where p.id = proyecto_id)
    )
  );

revoke all on public.ci_jornales_obra_tarifas from anon;
revoke all on public.ci_jornales_obra_asistencias from anon;
revoke all on public.ci_proyecto_desviacion_config from anon;
revoke all on public.ci_v_jornales_obra_asistencias from anon;

grant select, insert, update, delete on public.ci_jornales_obra_tarifas to authenticated, service_role;
grant select, insert, update, delete on public.ci_jornales_obra_asistencias to authenticated, service_role;
grant select, insert, update, delete on public.ci_proyecto_desviacion_config to authenticated, service_role;
grant select on public.ci_v_jornales_obra_asistencias to authenticated, service_role;

notify pgrst, 'reload schema';
