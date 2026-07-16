-- Bitácora de obra por nota de voz (Telegram + Gemini) y estado conversacional.

-- Ampliar contextos del bot
alter table public.ci_telegram_estados
  drop constraint if exists ci_telegram_estados_contexto_check;

alter table public.ci_telegram_estados
  add constraint ci_telegram_estados_contexto_check
  check (contexto in (
    'menu',
    'factura',
    'obra',
    'gasto_obra',
    'esperando_audio_bitacora'
  ));

comment on table public.ci_telegram_estados is
  'Contexto activo por chat de Telegram (menú, factura, obra, gastos, bitácora por voz).';

-- Registros de bitácora estructurada
create table if not exists public.ci_bitacora_obras (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  chat_id text,
  transcripcion text not null,
  datos_json jsonb not null default '{}'::jsonb,
  telegram_file_id text,
  duracion_segundos integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_bitacora_obras_proyecto
  on public.ci_bitacora_obras (proyecto_id, created_at desc);

create index if not exists idx_ci_bitacora_obras_chat
  on public.ci_bitacora_obras (chat_id, created_at desc)
  where chat_id is not null;

comment on table public.ci_bitacora_obras is
  'Bitácora de campo vía Telegram: transcripción y JSON (avances, novedades, obreros activos).';

comment on column public.ci_bitacora_obras.datos_json is
  'Estructura Gemini: avances[], novedades_o_retrasos[], estimado_obreros_activos.';

alter table public.ci_bitacora_obras enable row level security;

drop policy if exists "ci_bitacora_obras_select_anon" on public.ci_bitacora_obras;
drop policy if exists "ci_bitacora_obras_insert_anon" on public.ci_bitacora_obras;
drop policy if exists "ci_bitacora_obras_update_anon" on public.ci_bitacora_obras;
drop policy if exists "ci_bitacora_obras_delete_anon" on public.ci_bitacora_obras;
drop policy if exists "ci_bitacora_obras_select_authenticated" on public.ci_bitacora_obras;
drop policy if exists "ci_bitacora_obras_insert_authenticated" on public.ci_bitacora_obras;
drop policy if exists "ci_bitacora_obras_update_authenticated" on public.ci_bitacora_obras;
drop policy if exists "ci_bitacora_obras_delete_authenticated" on public.ci_bitacora_obras;

create policy "ci_bitacora_obras_select_anon"
  on public.ci_bitacora_obras for select to anon using (true);
create policy "ci_bitacora_obras_insert_anon"
  on public.ci_bitacora_obras for insert to anon with check (true);
create policy "ci_bitacora_obras_update_anon"
  on public.ci_bitacora_obras for update to anon using (true) with check (true);
create policy "ci_bitacora_obras_delete_anon"
  on public.ci_bitacora_obras for delete to anon using (true);

create policy "ci_bitacora_obras_select_authenticated"
  on public.ci_bitacora_obras for select to authenticated using (true);
create policy "ci_bitacora_obras_insert_authenticated"
  on public.ci_bitacora_obras for insert to authenticated with check (true);
create policy "ci_bitacora_obras_update_authenticated"
  on public.ci_bitacora_obras for update to authenticated using (true) with check (true);
create policy "ci_bitacora_obras_delete_authenticated"
  on public.ci_bitacora_obras for delete to authenticated using (true);

notify pgrst, 'reload schema';
