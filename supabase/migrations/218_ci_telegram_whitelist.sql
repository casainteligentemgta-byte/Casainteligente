-- Lista blanca del bot de Telegram (alta rápida + sincronización desde nómina).

create table if not exists public.ci_telegram_whitelist (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  nombre text not null,
  telefono text,
  email text,
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  empleado_id uuid references public.ci_empleados (id) on delete set null,
  nomina_id uuid references public.ci_proyecto_nomina (id) on delete set null,
  origen text not null default 'manual'
    check (origen in ('manual', 'nomina', 'empleado')),
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_ci_telegram_whitelist_chat_id
  on public.ci_telegram_whitelist (chat_id);

create index if not exists idx_ci_telegram_whitelist_activo
  on public.ci_telegram_whitelist (activo, updated_at desc);

comment on table public.ci_telegram_whitelist is
  'Chats autorizados para interactuar con el bot de Telegram (lista blanca global).';

alter table public.ci_telegram_whitelist enable row level security;

drop policy if exists "ci_telegram_whitelist_select_anon" on public.ci_telegram_whitelist;
drop policy if exists "ci_telegram_whitelist_insert_anon" on public.ci_telegram_whitelist;
drop policy if exists "ci_telegram_whitelist_update_anon" on public.ci_telegram_whitelist;
drop policy if exists "ci_telegram_whitelist_delete_anon" on public.ci_telegram_whitelist;
drop policy if exists "ci_telegram_whitelist_select_auth" on public.ci_telegram_whitelist;
drop policy if exists "ci_telegram_whitelist_insert_auth" on public.ci_telegram_whitelist;
drop policy if exists "ci_telegram_whitelist_update_auth" on public.ci_telegram_whitelist;
drop policy if exists "ci_telegram_whitelist_delete_auth" on public.ci_telegram_whitelist;

create policy "ci_telegram_whitelist_select_anon" on public.ci_telegram_whitelist
  for select to anon using (true);
create policy "ci_telegram_whitelist_insert_anon" on public.ci_telegram_whitelist
  for insert to anon with check (true);
create policy "ci_telegram_whitelist_update_anon" on public.ci_telegram_whitelist
  for update to anon using (true) with check (true);
create policy "ci_telegram_whitelist_delete_anon" on public.ci_telegram_whitelist
  for delete to anon using (true);

create policy "ci_telegram_whitelist_select_auth" on public.ci_telegram_whitelist
  for select to authenticated using (true);
create policy "ci_telegram_whitelist_insert_auth" on public.ci_telegram_whitelist
  for insert to authenticated with check (true);
create policy "ci_telegram_whitelist_update_auth" on public.ci_telegram_whitelist
  for update to authenticated using (true) with check (true);
create policy "ci_telegram_whitelist_delete_auth" on public.ci_telegram_whitelist
  for delete to authenticated using (true);

notify pgrst, 'reload schema';
