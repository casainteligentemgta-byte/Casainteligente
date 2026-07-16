-- Entradas y salidas de material en obra registradas por Telegram (foto + observación).

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
    'salida_obra'
  ));

create table if not exists public.ci_obra_movimientos_material (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida')),
  foto_storage_path text not null,
  foto_url text,
  observacion text not null default '',
  chat_id text,
  telegram_user_id text,
  telegram_username text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_obra_movimientos_proyecto_fecha
  on public.ci_obra_movimientos_material (proyecto_id, created_at desc);

create index if not exists idx_ci_obra_movimientos_tipo
  on public.ci_obra_movimientos_material (proyecto_id, tipo, created_at desc);

comment on table public.ci_obra_movimientos_material is
  'Registro de entradas y salidas de material en obra vía Telegram (foto + detalle).';

alter table public.ci_obra_movimientos_material enable row level security;

drop policy if exists "ci_obra_movimientos_select_anon" on public.ci_obra_movimientos_material;
drop policy if exists "ci_obra_movimientos_insert_anon" on public.ci_obra_movimientos_material;
drop policy if exists "ci_obra_movimientos_update_anon" on public.ci_obra_movimientos_material;
drop policy if exists "ci_obra_movimientos_delete_anon" on public.ci_obra_movimientos_material;
drop policy if exists "ci_obra_movimientos_select_authenticated" on public.ci_obra_movimientos_material;
drop policy if exists "ci_obra_movimientos_insert_authenticated" on public.ci_obra_movimientos_material;
drop policy if exists "ci_obra_movimientos_update_authenticated" on public.ci_obra_movimientos_material;
drop policy if exists "ci_obra_movimientos_delete_authenticated" on public.ci_obra_movimientos_material;

create policy "ci_obra_movimientos_select_anon"
  on public.ci_obra_movimientos_material for select to anon using (true);
create policy "ci_obra_movimientos_insert_anon"
  on public.ci_obra_movimientos_material for insert to anon with check (true);
create policy "ci_obra_movimientos_update_anon"
  on public.ci_obra_movimientos_material for update to anon using (true) with check (true);
create policy "ci_obra_movimientos_delete_anon"
  on public.ci_obra_movimientos_material for delete to anon using (true);

create policy "ci_obra_movimientos_select_authenticated"
  on public.ci_obra_movimientos_material for select to authenticated using (true);
create policy "ci_obra_movimientos_insert_authenticated"
  on public.ci_obra_movimientos_material for insert to authenticated with check (true);
create policy "ci_obra_movimientos_update_authenticated"
  on public.ci_obra_movimientos_material for update to authenticated using (true) with check (true);
create policy "ci_obra_movimientos_delete_authenticated"
  on public.ci_obra_movimientos_material for delete to authenticated using (true);

notify pgrst, 'reload schema';
