-- Gestión de campo, cronograma dinámico y alertas Telegram (ingeniero residente + avance diario).

-- ---------------------------------------------------------------------------
-- Perfiles (ingenieros / residentes de obra)
-- ---------------------------------------------------------------------------
create table if not exists public.perfiles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telegram_chat_id bigint unique,
  telegram_username text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_perfiles_activo on public.perfiles (activo) where activo = true;

comment on table public.perfiles is
  'Perfiles de ingenieros residentes y personal de campo (vinculación Telegram).';

-- ---------------------------------------------------------------------------
-- Asignación ingeniero ↔ proyecto (ci_proyectos)
-- ---------------------------------------------------------------------------
create table if not exists public.proyecto_ingenieros (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  rol text not null default 'ingeniero_residente',
  created_at timestamptz not null default now(),
  constraint proyecto_ingenieros_unique unique (proyecto_id, perfil_id)
);

create index if not exists idx_proyecto_ingenieros_proyecto
  on public.proyecto_ingenieros (proyecto_id);

create index if not exists idx_proyecto_ingenieros_perfil
  on public.proyecto_ingenieros (perfil_id);

comment on table public.proyecto_ingenieros is
  'Ingeniero residente asignado a un proyecto de obra.';

-- ---------------------------------------------------------------------------
-- Extensiones presupuesto cascada (Lulo)
-- ---------------------------------------------------------------------------
alter table public.capitulos
  add column if not exists num_cap int;

comment on column public.capitulos.num_cap is
  'Número de capítulo Lulo (ObraCapi). Si null, se infiere del código.';

alter table public.partidas
  add column if not exists codigo_lulo text;

alter table public.partidas
  add column if not exists rendimiento numeric(12, 4) not null default 1;

comment on column public.partidas.codigo_lulo is
  'Código Lulo (CodPar); alias de codigo cuando difiere en formato.';

comment on column public.partidas.rendimiento is
  'Rendimiento teórico diario Lulo (ObraApun / catálogo) para eficiencia en campo.';

-- Quitar UNIQUE global erróneo en codigo_lulo (debe ser único por capítulo vía `codigo`)
alter table public.partidas drop constraint if exists uq_partidas_codigo_lulo;

-- Backfill codigo_lulo desde codigo (sin duplicar dentro del mismo capítulo)
update public.partidas p
set codigo_lulo = p.codigo
where (p.codigo_lulo is null or p.codigo_lulo = '')
  and not exists (
    select 1
    from public.partidas o
    where o.capitulo_id = p.capitulo_id
      and o.id <> p.id
      and upper(trim(coalesce(nullif(o.codigo_lulo, ''), o.codigo))) = upper(trim(p.codigo))
  );

update public.capitulos c
set num_cap = nullif(
  regexp_replace(c.codigo, '[^0-9]', '', 'g')::int,
  0
)
where num_cap is null
  and c.codigo ~ '[0-9]';

-- ---------------------------------------------------------------------------
-- Avance diario de campo (alimenta Curva S)
-- ---------------------------------------------------------------------------
create table if not exists public.avance_diario_campo (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  partida_id uuid not null references public.partidas (id) on delete cascade,
  perfil_id uuid references public.perfiles (id) on delete set null,
  fecha_reporte date not null default (timezone('utc', now()))::date,
  cantidad_ejecutada_hoy numeric(15, 4) not null default 0,
  rendimiento_teorico numeric(15, 4) not null default 1,
  eficiencia_calculada numeric(8, 2) not null default 0,
  rentabilidad_diaria numeric(15, 2) not null default 0,
  unidad text not null default 'UND',
  notas text,
  telegram_user_id text,
  created_at timestamptz not null default now(),
  constraint avance_diario_cantidad_no_negativa check (cantidad_ejecutada_hoy >= 0),
  constraint avance_diario_unique_dia unique (partida_id, fecha_reporte, perfil_id)
);

create index if not exists idx_avance_diario_proyecto_fecha
  on public.avance_diario_campo (proyecto_id, fecha_reporte desc);

create index if not exists idx_avance_diario_partida
  on public.avance_diario_campo (partida_id, fecha_reporte desc);

comment on table public.avance_diario_campo is
  'Avance físico diario por partida (Telegram / web) para cronograma y Curva S.';

-- ---------------------------------------------------------------------------
-- Tokens deep-link Telegram (?start=TOKEN)
-- ---------------------------------------------------------------------------
create table if not exists public.telegram_vinculo_tokens (
  token text primary key,
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_vinculo_perfil
  on public.telegram_vinculo_tokens (perfil_id, expires_at desc);

comment on table public.telegram_vinculo_tokens is
  'Tokens temporales para vincular telegram_chat_id vía /start TOKEN.';

-- ---------------------------------------------------------------------------
-- Contexto Telegram: avance de campo
-- ---------------------------------------------------------------------------
alter table public.ci_telegram_estados
  drop constraint if exists ci_telegram_estados_contexto_check;

alter table public.ci_telegram_estados
  add constraint ci_telegram_estados_contexto_check
  check (contexto in (
    'menu',
    'factura',
    'obra',
    'gasto_obra',
    'esperando_audio_bitacora',
    'entrada_obra',
    'salida_obra',
    'avance_campo',
    'avance_campo_cantidad'
  ));

-- RLS
alter table public.perfiles enable row level security;
alter table public.proyecto_ingenieros enable row level security;
alter table public.avance_diario_campo enable row level security;
alter table public.telegram_vinculo_tokens enable row level security;

drop policy if exists "perfiles_select_anon" on public.perfiles;
drop policy if exists "perfiles_insert_anon" on public.perfiles;
drop policy if exists "perfiles_update_anon" on public.perfiles;
drop policy if exists "perfiles_select_authenticated" on public.perfiles;
drop policy if exists "perfiles_insert_authenticated" on public.perfiles;
drop policy if exists "perfiles_update_authenticated" on public.perfiles;

create policy "perfiles_select_anon" on public.perfiles for select to anon using (true);
create policy "perfiles_insert_anon" on public.perfiles for insert to anon with check (true);
create policy "perfiles_update_anon" on public.perfiles for update to anon using (true) with check (true);
create policy "perfiles_select_authenticated" on public.perfiles for select to authenticated using (true);
create policy "perfiles_insert_authenticated" on public.perfiles for insert to authenticated with check (true);
create policy "perfiles_update_authenticated" on public.perfiles for update to authenticated using (true) with check (true);

drop policy if exists "proyecto_ingenieros_select_anon" on public.proyecto_ingenieros;
drop policy if exists "proyecto_ingenieros_insert_anon" on public.proyecto_ingenieros;
drop policy if exists "proyecto_ingenieros_update_anon" on public.proyecto_ingenieros;
drop policy if exists "proyecto_ingenieros_delete_anon" on public.proyecto_ingenieros;
drop policy if exists "proyecto_ingenieros_select_authenticated" on public.proyecto_ingenieros;
drop policy if exists "proyecto_ingenieros_insert_authenticated" on public.proyecto_ingenieros;
drop policy if exists "proyecto_ingenieros_update_authenticated" on public.proyecto_ingenieros;
drop policy if exists "proyecto_ingenieros_delete_authenticated" on public.proyecto_ingenieros;

create policy "proyecto_ingenieros_select_anon" on public.proyecto_ingenieros for select to anon using (true);
create policy "proyecto_ingenieros_insert_anon" on public.proyecto_ingenieros for insert to anon with check (true);
create policy "proyecto_ingenieros_update_anon" on public.proyecto_ingenieros for update to anon using (true) with check (true);
create policy "proyecto_ingenieros_delete_anon" on public.proyecto_ingenieros for delete to anon using (true);
create policy "proyecto_ingenieros_select_authenticated" on public.proyecto_ingenieros for select to authenticated using (true);
create policy "proyecto_ingenieros_insert_authenticated" on public.proyecto_ingenieros for insert to authenticated with check (true);
create policy "proyecto_ingenieros_update_authenticated" on public.proyecto_ingenieros for update to authenticated using (true) with check (true);
create policy "proyecto_ingenieros_delete_authenticated" on public.proyecto_ingenieros for delete to authenticated using (true);

drop policy if exists "avance_diario_select_anon" on public.avance_diario_campo;
drop policy if exists "avance_diario_insert_anon" on public.avance_diario_campo;
drop policy if exists "avance_diario_update_anon" on public.avance_diario_campo;
drop policy if exists "avance_diario_select_authenticated" on public.avance_diario_campo;
drop policy if exists "avance_diario_insert_authenticated" on public.avance_diario_campo;
drop policy if exists "avance_diario_update_authenticated" on public.avance_diario_campo;

create policy "avance_diario_select_anon" on public.avance_diario_campo for select to anon using (true);
create policy "avance_diario_insert_anon" on public.avance_diario_campo for insert to anon with check (true);
create policy "avance_diario_update_anon" on public.avance_diario_campo for update to anon using (true) with check (true);
create policy "avance_diario_select_authenticated" on public.avance_diario_campo for select to authenticated using (true);
create policy "avance_diario_insert_authenticated" on public.avance_diario_campo for insert to authenticated with check (true);
create policy "avance_diario_update_authenticated" on public.avance_diario_campo for update to authenticated using (true) with check (true);

drop policy if exists "telegram_vinculo_select_anon" on public.telegram_vinculo_tokens;
drop policy if exists "telegram_vinculo_insert_anon" on public.telegram_vinculo_tokens;
drop policy if exists "telegram_vinculo_update_anon" on public.telegram_vinculo_tokens;
drop policy if exists "telegram_vinculo_select_authenticated" on public.telegram_vinculo_tokens;
drop policy if exists "telegram_vinculo_insert_authenticated" on public.telegram_vinculo_tokens;
drop policy if exists "telegram_vinculo_update_authenticated" on public.telegram_vinculo_tokens;

create policy "telegram_vinculo_select_anon" on public.telegram_vinculo_tokens for select to anon using (true);
create policy "telegram_vinculo_insert_anon" on public.telegram_vinculo_tokens for insert to anon with check (true);
create policy "telegram_vinculo_update_anon" on public.telegram_vinculo_tokens for update to anon using (true) with check (true);
create policy "telegram_vinculo_select_authenticated" on public.telegram_vinculo_tokens for select to authenticated using (true);
create policy "telegram_vinculo_insert_authenticated" on public.telegram_vinculo_tokens for insert to authenticated with check (true);
create policy "telegram_vinculo_update_authenticated" on public.telegram_vinculo_tokens for update to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
