-- Máquina de estados Telegram: registro de agua (tanque + prueba).

create table if not exists public.bot_estados (
  user_id text primary key,
  chat_id text not null,
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  estado text not null
    check (estado in ('ESPERANDO_FOTO_TANQUE', 'ESPERANDO_FOTO_PRUEBA')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bot_estados_proyecto
  on public.bot_estados (proyecto_id);

create index if not exists idx_bot_estados_estado
  on public.bot_estados (estado, updated_at desc);

comment on table public.bot_estados is
  'Flujo /agua en Telegram: obra seleccionada y fotos pendientes por usuario.';

create table if not exists public.registro_agua_obrero (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  foto_tanque_url text not null,
  foto_prueba_url text not null,
  creado_por text not null,
  chat_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_registro_agua_obrero_proyecto
  on public.registro_agua_obrero (proyecto_id, created_at desc);

create index if not exists idx_registro_agua_obrero_creado_por
  on public.registro_agua_obrero (creado_por, created_at desc);

comment on table public.registro_agua_obrero is
  'Registro de agua en obra: fotos de tanque y prueba enviadas por Telegram.';

alter table public.bot_estados enable row level security;
alter table public.registro_agua_obrero enable row level security;

drop policy if exists "bot_estados_select_anon" on public.bot_estados;
drop policy if exists "bot_estados_insert_anon" on public.bot_estados;
drop policy if exists "bot_estados_update_anon" on public.bot_estados;
drop policy if exists "bot_estados_delete_anon" on public.bot_estados;

create policy "bot_estados_select_anon"
  on public.bot_estados for select to anon using (true);
create policy "bot_estados_insert_anon"
  on public.bot_estados for insert to anon with check (true);
create policy "bot_estados_update_anon"
  on public.bot_estados for update to anon using (true) with check (true);
create policy "bot_estados_delete_anon"
  on public.bot_estados for delete to anon using (true);

drop policy if exists "registro_agua_obrero_select_anon" on public.registro_agua_obrero;
drop policy if exists "registro_agua_obrero_insert_anon" on public.registro_agua_obrero;

create policy "registro_agua_obrero_select_anon"
  on public.registro_agua_obrero for select to anon using (true);
create policy "registro_agua_obrero_insert_anon"
  on public.registro_agua_obrero for insert to anon with check (true);

notify pgrst, 'reload schema';
