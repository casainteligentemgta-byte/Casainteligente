-- Modulo PROYECTOS (CASA INTELIGENTE)
-- Incluye: proyecto por cliente, ubicacion textual + GPS, monto aproximado, presupuesto asociado,
-- inventario tecnico, fotos/planos y bitacora de visitas de inspeccion.

-- 1) Proyecto principal
create table if not exists public.ci_proyectos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  budget_id uuid references public.budgets(id) on delete set null,

  nombre text not null,
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'levantamiento', 'presupuestado', 'ejecucion', 'entregado', 'cerrado', 'cancelado')),

  ubicacion_texto text not null,
  lat numeric(10, 7),
  lng numeric(10, 7),

  monto_aproximado numeric(14, 2) not null default 0,
  moneda text not null default 'USD',

  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ci_proyectos_monto_no_negativo check (monto_aproximado >= 0)
);

create index if not exists idx_ci_proyectos_cliente on public.ci_proyectos (customer_id);
create index if not exists idx_ci_proyectos_estado on public.ci_proyectos (estado);
create index if not exists idx_ci_proyectos_budget on public.ci_proyectos (budget_id);

comment on table public.ci_proyectos is
  'Modulo de proyectos por cliente: ubicacion texto/GPS, monto estimado y presupuesto asociado.';
comment on column public.ci_proyectos.ubicacion_texto is
  'Direccion escrita del proyecto (referencia principal).';
comment on column public.ci_proyectos.lat is
  'Coordenada GPS latitud decimal.';
comment on column public.ci_proyectos.lng is
  'Coordenada GPS longitud decimal.';
comment on column public.ci_proyectos.monto_aproximado is
  'Monto aproximado referencial del proyecto.';

-- 2) Inventario tecnico del proyecto
create table if not exists public.ci_proyecto_equipos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos(id) on delete cascade,

  categoria text,
  nombre_equipo text not null,
  marca text,
  modelo text,
  serial text,
  cantidad numeric(14, 3) not null default 1,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ci_proyecto_equipos_cantidad_positiva check (cantidad > 0)
);

create index if not exists idx_ci_proyecto_equipos_proyecto on public.ci_proyecto_equipos (proyecto_id);
create index if not exists idx_ci_proyecto_equipos_serial on public.ci_proyecto_equipos (serial);

comment on table public.ci_proyecto_equipos is
  'Inventario de equipos por proyecto: marca, modelo, serial y cantidad.';

-- 3) Evidencias del proyecto (fotos/planos/otros)
create table if not exists public.ci_proyecto_archivos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos(id) on delete cascade,

  tipo text not null
    check (tipo in ('foto_proyecto', 'plano', 'documento', 'otro')),
  titulo text,
  descripcion text,

  storage_bucket text,
  storage_path text,
  public_url text,
  mime_type text,

  created_at timestamptz not null default now()
);

create index if not exists idx_ci_proyecto_archivos_proyecto on public.ci_proyecto_archivos (proyecto_id);
create index if not exists idx_ci_proyecto_archivos_tipo on public.ci_proyecto_archivos (tipo);

comment on table public.ci_proyecto_archivos is
  'Archivos del proyecto: fotos y planos (rutas de Storage y/o URL publica).';

-- 4) Historial de visitas / inspecciones tecnicas
create table if not exists public.ci_proyecto_visitas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos(id) on delete cascade,

  tecnico_nombre text not null,
  tecnico_usuario_id uuid,

  fecha_hora_visita timestamptz not null default now(),
  foto_antes_storage_bucket text,
  foto_antes_storage_path text,
  foto_antes_public_url text,

  informe_breve text not null,
  recomendaciones text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_proyecto_visitas_proyecto on public.ci_proyecto_visitas (proyecto_id);
create index if not exists idx_ci_proyecto_visitas_fecha on public.ci_proyecto_visitas (fecha_hora_visita desc);

comment on table public.ci_proyecto_visitas is
  'Bitacora de visitas de inspeccion: evidencia previa, fecha/hora e informe tecnico.';

-- 5) Evidencias adicionales por visita (opcional, multiples fotos)
create table if not exists public.ci_proyecto_visita_archivos (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references public.ci_proyecto_visitas(id) on delete cascade,

  tipo text not null
    check (tipo in ('foto_antes', 'foto_durante', 'foto_despues', 'documento', 'otro')),
  titulo text,
  storage_bucket text,
  storage_path text,
  public_url text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_proyecto_visita_archivos_visita on public.ci_proyecto_visita_archivos (visita_id);
create index if not exists idx_ci_proyecto_visita_archivos_tipo on public.ci_proyecto_visita_archivos (tipo);

comment on table public.ci_proyecto_visita_archivos is
  'Archivos anexos de cada visita tecnica.';

-- 6) RLS habilitado
alter table public.ci_proyectos enable row level security;
alter table public.ci_proyecto_equipos enable row level security;
alter table public.ci_proyecto_archivos enable row level security;
alter table public.ci_proyecto_visitas enable row level security;
alter table public.ci_proyecto_visita_archivos enable row level security;

-- 7) Politicas anon/auth (alineado al resto del repo)
-- ci_proyectos
drop policy if exists "ci_proyectos_select_anon" on public.ci_proyectos;
drop policy if exists "ci_proyectos_insert_anon" on public.ci_proyectos;
drop policy if exists "ci_proyectos_update_anon" on public.ci_proyectos;
drop policy if exists "ci_proyectos_delete_anon" on public.ci_proyectos;
drop policy if exists "ci_proyectos_select_auth" on public.ci_proyectos;
drop policy if exists "ci_proyectos_insert_auth" on public.ci_proyectos;
drop policy if exists "ci_proyectos_update_auth" on public.ci_proyectos;
drop policy if exists "ci_proyectos_delete_auth" on public.ci_proyectos;

create policy "ci_proyectos_select_anon" on public.ci_proyectos for select to anon using (true);
create policy "ci_proyectos_insert_anon" on public.ci_proyectos for insert to anon with check (true);
create policy "ci_proyectos_update_anon" on public.ci_proyectos for update to anon using (true) with check (true);
create policy "ci_proyectos_delete_anon" on public.ci_proyectos for delete to anon using (true);
create policy "ci_proyectos_select_auth" on public.ci_proyectos for select to authenticated using (true);
create policy "ci_proyectos_insert_auth" on public.ci_proyectos for insert to authenticated with check (true);
create policy "ci_proyectos_update_auth" on public.ci_proyectos for update to authenticated using (true) with check (true);
create policy "ci_proyectos_delete_auth" on public.ci_proyectos for delete to authenticated using (true);

-- ci_proyecto_equipos
drop policy if exists "ci_proyecto_equipos_select_anon" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_insert_anon" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_update_anon" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_delete_anon" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_select_auth" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_insert_auth" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_update_auth" on public.ci_proyecto_equipos;
drop policy if exists "ci_proyecto_equipos_delete_auth" on public.ci_proyecto_equipos;

create policy "ci_proyecto_equipos_select_anon" on public.ci_proyecto_equipos for select to anon using (true);
create policy "ci_proyecto_equipos_insert_anon" on public.ci_proyecto_equipos for insert to anon with check (true);
create policy "ci_proyecto_equipos_update_anon" on public.ci_proyecto_equipos for update to anon using (true) with check (true);
create policy "ci_proyecto_equipos_delete_anon" on public.ci_proyecto_equipos for delete to anon using (true);
create policy "ci_proyecto_equipos_select_auth" on public.ci_proyecto_equipos for select to authenticated using (true);
create policy "ci_proyecto_equipos_insert_auth" on public.ci_proyecto_equipos for insert to authenticated with check (true);
create policy "ci_proyecto_equipos_update_auth" on public.ci_proyecto_equipos for update to authenticated using (true) with check (true);
create policy "ci_proyecto_equipos_delete_auth" on public.ci_proyecto_equipos for delete to authenticated using (true);

-- ci_proyecto_archivos
drop policy if exists "ci_proyecto_archivos_select_anon" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_insert_anon" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_update_anon" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_delete_anon" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_select_auth" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_insert_auth" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_update_auth" on public.ci_proyecto_archivos;
drop policy if exists "ci_proyecto_archivos_delete_auth" on public.ci_proyecto_archivos;

create policy "ci_proyecto_archivos_select_anon" on public.ci_proyecto_archivos for select to anon using (true);
create policy "ci_proyecto_archivos_insert_anon" on public.ci_proyecto_archivos for insert to anon with check (true);
create policy "ci_proyecto_archivos_update_anon" on public.ci_proyecto_archivos for update to anon using (true) with check (true);
create policy "ci_proyecto_archivos_delete_anon" on public.ci_proyecto_archivos for delete to anon using (true);
create policy "ci_proyecto_archivos_select_auth" on public.ci_proyecto_archivos for select to authenticated using (true);
create policy "ci_proyecto_archivos_insert_auth" on public.ci_proyecto_archivos for insert to authenticated with check (true);
create policy "ci_proyecto_archivos_update_auth" on public.ci_proyecto_archivos for update to authenticated using (true) with check (true);
create policy "ci_proyecto_archivos_delete_auth" on public.ci_proyecto_archivos for delete to authenticated using (true);

-- ci_proyecto_visitas
drop policy if exists "ci_proyecto_visitas_select_anon" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_insert_anon" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_update_anon" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_delete_anon" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_select_auth" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_insert_auth" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_update_auth" on public.ci_proyecto_visitas;
drop policy if exists "ci_proyecto_visitas_delete_auth" on public.ci_proyecto_visitas;

create policy "ci_proyecto_visitas_select_anon" on public.ci_proyecto_visitas for select to anon using (true);
create policy "ci_proyecto_visitas_insert_anon" on public.ci_proyecto_visitas for insert to anon with check (true);
create policy "ci_proyecto_visitas_update_anon" on public.ci_proyecto_visitas for update to anon using (true) with check (true);
create policy "ci_proyecto_visitas_delete_anon" on public.ci_proyecto_visitas for delete to anon using (true);
create policy "ci_proyecto_visitas_select_auth" on public.ci_proyecto_visitas for select to authenticated using (true);
create policy "ci_proyecto_visitas_insert_auth" on public.ci_proyecto_visitas for insert to authenticated with check (true);
create policy "ci_proyecto_visitas_update_auth" on public.ci_proyecto_visitas for update to authenticated using (true) with check (true);
create policy "ci_proyecto_visitas_delete_auth" on public.ci_proyecto_visitas for delete to authenticated using (true);

-- ci_proyecto_visita_archivos
drop policy if exists "ci_proyecto_visita_archivos_select_anon" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_insert_anon" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_update_anon" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_delete_anon" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_select_auth" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_insert_auth" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_update_auth" on public.ci_proyecto_visita_archivos;
drop policy if exists "ci_proyecto_visita_archivos_delete_auth" on public.ci_proyecto_visita_archivos;

create policy "ci_proyecto_visita_archivos_select_anon" on public.ci_proyecto_visita_archivos for select to anon using (true);
create policy "ci_proyecto_visita_archivos_insert_anon" on public.ci_proyecto_visita_archivos for insert to anon with check (true);
create policy "ci_proyecto_visita_archivos_update_anon" on public.ci_proyecto_visita_archivos for update to anon using (true) with check (true);
create policy "ci_proyecto_visita_archivos_delete_anon" on public.ci_proyecto_visita_archivos for delete to anon using (true);
create policy "ci_proyecto_visita_archivos_select_auth" on public.ci_proyecto_visita_archivos for select to authenticated using (true);
create policy "ci_proyecto_visita_archivos_insert_auth" on public.ci_proyecto_visita_archivos for insert to authenticated with check (true);
create policy "ci_proyecto_visita_archivos_update_auth" on public.ci_proyecto_visita_archivos for update to authenticated using (true) with check (true);
create policy "ci_proyecto_visita_archivos_delete_auth" on public.ci_proyecto_visita_archivos for delete to authenticated using (true);
