-- Departamento de compras: capítulos maestro, usuarios Telegram por rol, extensión ci_procuras.

-- Capítulos globales de obra (CAP-I, CAP-IV, …) — no sustituyen capitulos por proyecto (migr. 164).
create table if not exists public.ci_compras_capitulos_maestro (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(20) not null,
  nombre varchar(100) not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ci_compras_capitulos_maestro_codigo_unique unique (codigo)
);

comment on table public.ci_compras_capitulos_maestro is
  'Catálogo maestro de capítulos de obra para procuras (ej. CAP-I Obras civiles).';

insert into public.ci_compras_capitulos_maestro (codigo, nombre)
values
  ('CAP-I', 'Obras civiles'),
  ('CAP-II', 'Estructura'),
  ('CAP-III', 'Instalaciones'),
  ('CAP-IV', 'Domótica'),
  ('CAP-V', 'Acabados')
on conflict (codigo) do nothing;

-- Usuarios del departamento de compras (validación estricta por telegram_id).
create table if not exists public.ci_usuarios_sistema_telegram (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(150) not null,
  telegram_id bigint not null,
  rol text not null default 'Solicitante'
    check (rol in ('Solicitante', 'Aprobador', 'Comprador', 'Administrador')),
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_usuarios_sistema_telegram_tg_unique unique (telegram_id)
);

create index if not exists idx_ci_usuarios_sistema_telegram_activo
  on public.ci_usuarios_sistema_telegram (activo, rol);

comment on table public.ci_usuarios_sistema_telegram is
  'Usuarios autorizados del bot de compras; rol validado antes de cada acción.';

-- Extensión ci_procuras
alter table public.ci_procuras
  add column if not exists capitulo_maestro_id uuid
    references public.ci_compras_capitulos_maestro (id) on delete set null;

alter table public.ci_procuras
  add column if not exists prioridad text default 'Media'
    check (prioridad is null or prioridad in ('Baja', 'Media', 'Alta'));

alter table public.ci_procuras
  add column if not exists monto_estimado_usd numeric(12, 2);

alter table public.ci_procuras
  add column if not exists es_consumible boolean not null default false;

alter table public.ci_procuras
  add column if not exists via_rapida boolean not null default false;

alter table public.ci_procuras
  add column if not exists motivo_rechazo text;

comment on column public.ci_procuras.capitulo_maestro_id is 'Capítulo maestro CAP-* de la solicitud.';
comment on column public.ci_procuras.via_rapida is 'True si calificó vía rápida (consumible o monto bajo).';

-- Estado aprobada_directa (vía rápida)
alter table public.ci_procuras drop constraint if exists ci_procuras_estado_check;

alter table public.ci_procuras
  add constraint ci_procuras_estado_check
  check (
    estado in (
      'borrador',
      'solicitada',
      'aprobada',
      'aprobada_directa',
      'en_compra',
      'recibida_parcial',
      'recibida',
      'cancelada',
      'rechazada'
    )
  );

-- Contexto Telegram departamento compras
alter table public.ci_telegram_estados
  drop constraint if exists ci_telegram_estados_contexto_check;

alter table public.ci_telegram_estados
  add constraint ci_telegram_estados_contexto_check
  check (contexto in (
    'menu', 'factura', 'obra', 'gasto_obra', 'esperando_audio_bitacora',
    'entrada_obra', 'salida_obra', 'avance_campo', 'avance_campo_cantidad',
    'procura_solicitud', 'procura_departamento'
  ));

alter table public.ci_compras_capitulos_maestro enable row level security;
alter table public.ci_usuarios_sistema_telegram enable row level security;

drop policy if exists "ci_compras_capitulos_maestro_all_anon" on public.ci_compras_capitulos_maestro;
create policy "ci_compras_capitulos_maestro_all_anon" on public.ci_compras_capitulos_maestro
  for all to anon using (true) with check (true);

drop policy if exists "ci_compras_capitulos_maestro_all_auth" on public.ci_compras_capitulos_maestro;
create policy "ci_compras_capitulos_maestro_all_auth" on public.ci_compras_capitulos_maestro
  for all to authenticated using (true) with check (true);

drop policy if exists "ci_usuarios_sistema_telegram_all_anon" on public.ci_usuarios_sistema_telegram;
create policy "ci_usuarios_sistema_telegram_all_anon" on public.ci_usuarios_sistema_telegram
  for all to anon using (true) with check (true);

drop policy if exists "ci_usuarios_sistema_telegram_all_auth" on public.ci_usuarios_sistema_telegram;
create policy "ci_usuarios_sistema_telegram_all_auth" on public.ci_usuarios_sistema_telegram
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
