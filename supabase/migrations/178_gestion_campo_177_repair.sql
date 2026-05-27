-- Reparación si 177 falló en el backfill de codigo_lulo (completa tablas de campo).

alter table public.partidas drop constraint if exists uq_partidas_codigo_lulo;

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

create table if not exists public.proyecto_ingenieros (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  rol text not null default 'ingeniero_residente',
  created_at timestamptz not null default now(),
  constraint proyecto_ingenieros_unique unique (proyecto_id, perfil_id)
);

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

create table if not exists public.telegram_vinculo_tokens (
  token text primary key,
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ci_telegram_estados
  drop constraint if exists ci_telegram_estados_contexto_check;

alter table public.ci_telegram_estados
  add constraint ci_telegram_estados_contexto_check
  check (contexto in (
    'menu', 'factura', 'obra', 'gasto_obra', 'esperando_audio_bitacora',
    'entrada_obra', 'salida_obra', 'avance_campo', 'avance_campo_cantidad'
  ));

notify pgrst, 'reload schema';
