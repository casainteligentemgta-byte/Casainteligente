-- Departamento Legal: producto acotado (obras + despacho / casos externos).
-- Acceso vía entitlements (monetizable); no abre el CRM completo.

create table if not exists public.ci_legal_orgs (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  plan text not null default 'owner'
    check (plan in ('owner', 'trial', 'solo', 'equipo', 'estudio')),
  status text not null default 'active'
    check (status in ('active', 'paused', 'cancelled')),
  valido_hasta timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ci_legal_orgs is
  'Tenant del producto Departamento Legal (dueño casa o clientes de pago futuros).';

create table if not exists public.ci_legal_entitlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.ci_legal_orgs (id) on delete cascade,
  user_id uuid not null,
  email text,
  rol_legal text not null default 'admin'
    check (rol_legal in ('admin', 'abogado', 'asistente', 'lectura')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_legal_entitlements_org_user unique (org_id, user_id)
);

create index if not exists idx_ci_legal_entitlements_user
  on public.ci_legal_entitlements (user_id)
  where activo;

comment on table public.ci_legal_entitlements is
  'Quién puede usar Departamento Legal (base de monetización por asiento).';

-- Casos: resolución (obra Casa Inteligente o externo / despacho)
create table if not exists public.ci_legal_casos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.ci_legal_orgs (id) on delete cascade,
  codigo text,
  titulo text not null,
  tipo text not null default 'otro'
    check (tipo in (
      'obra_contrato',
      'obra_reclamo',
      'laboral',
      'proveedor',
      'civil',
      'mercantil',
      'administrativo',
      'externo',
      'otro'
    )),
  ambito text not null default 'externo'
    check (ambito in ('obra', 'despacho', 'externo')),
  estado text not null default 'abierto'
    check (estado in (
      'abierto',
      'en_gestion',
      'espera_tercero',
      'audiencia',
      'resuelto',
      'archivado',
      'cancelado'
    )),
  prioridad text not null default 'media'
    check (prioridad in ('baja', 'media', 'alta', 'urgente')),
  resumen text,
  contraparte text,
  contraparte_rif text,
  cliente_nombre text,
  proyecto_id uuid,
  entidad_id uuid,
  fecha_apertura date not null default (timezone('America/Caracas', now()))::date,
  fecha_limite date,
  fecha_cierre date,
  creado_por uuid,
  asignado_a uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_legal_casos_org_estado
  on public.ci_legal_casos (org_id, estado);
create index if not exists idx_ci_legal_casos_proyecto
  on public.ci_legal_casos (proyecto_id)
  where proyecto_id is not null;

comment on table public.ci_legal_casos is
  'Expedientes / casos: obras CI + despacho general y resolución externa.';

create table if not exists public.ci_legal_actuaciones (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.ci_legal_casos (id) on delete cascade,
  org_id uuid not null references public.ci_legal_orgs (id) on delete cascade,
  tipo text not null default 'nota'
    check (tipo in (
      'nota',
      'llamada',
      'reunion',
      'escrito',
      'audiencia',
      'notificacion',
      'documento',
      'otro'
    )),
  titulo text,
  detalle text,
  ocurrio_at timestamptz not null default now(),
  creado_por uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_legal_actuaciones_caso
  on public.ci_legal_actuaciones (caso_id, ocurrio_at desc);

comment on table public.ci_legal_actuaciones is
  'Bitácora de actuación / resolución del caso (no solo plantillas de documentos).';

alter table public.ci_legal_orgs enable row level security;
alter table public.ci_legal_entitlements enable row level security;
alter table public.ci_legal_casos enable row level security;
alter table public.ci_legal_actuaciones enable row level security;

-- Políticas permisivas para authenticated; el gate de producto está en API (service role / checks).
-- Refinar RLS estricto cuando haya multi-tenant de pago.
drop policy if exists "ci_legal_orgs_auth" on public.ci_legal_orgs;
create policy "ci_legal_orgs_auth" on public.ci_legal_orgs
  for all to authenticated using (true) with check (true);

drop policy if exists "ci_legal_entitlements_auth" on public.ci_legal_entitlements;
create policy "ci_legal_entitlements_auth" on public.ci_legal_entitlements
  for all to authenticated using (true) with check (true);

drop policy if exists "ci_legal_casos_auth" on public.ci_legal_casos;
create policy "ci_legal_casos_auth" on public.ci_legal_casos
  for all to authenticated using (true) with check (true);

drop policy if exists "ci_legal_actuaciones_auth" on public.ci_legal_actuaciones;
create policy "ci_legal_actuaciones_auth" on public.ci_legal_actuaciones
  for all to authenticated using (true) with check (true);

-- Org + entitlement iniciales del dueño Casa Inteligente
insert into public.ci_legal_orgs (id, nombre, plan, status)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Casa Inteligente — Departamento Legal',
  'owner',
  'active'
)
on conflict (id) do nothing;

-- user_id del owner (casainteligentemgta@gmail.com) conocido en Auth
insert into public.ci_legal_entitlements (org_id, user_id, email, rol_legal, activo)
values (
  'a0000000-0000-4000-8000-000000000001',
  'b4fce4e9-470f-4285-935c-3c1cbbd5a4cd',
  'casainteligentemgta@gmail.com',
  'admin',
  true
)
on conflict (org_id, user_id) do update
  set activo = true,
      email = excluded.email,
      updated_at = now();

notify pgrst, 'reload schema';
