-- Estado conversacional del bot Telegram (multi-contexto: factura, obra, gastos).

create table if not exists public.ci_telegram_estados (
  chat_id text primary key,
  contexto text not null default 'menu'
    check (contexto in ('menu', 'factura', 'obra', 'gasto_obra')),
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  pending_factura_id uuid references public.ci_facturas_canal_pendientes (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_telegram_estados_contexto
  on public.ci_telegram_estados (contexto, updated_at desc);

create index if not exists idx_ci_telegram_estados_proyecto
  on public.ci_telegram_estados (proyecto_id)
  where proyecto_id is not null;

comment on table public.ci_telegram_estados is
  'Contexto activo por chat de Telegram (menú, factura de compra, fotos de obra, gastos de obra).';

alter table public.ci_telegram_estados enable row level security;

drop policy if exists "ci_telegram_estados_select_anon" on public.ci_telegram_estados;
drop policy if exists "ci_telegram_estados_insert_anon" on public.ci_telegram_estados;
drop policy if exists "ci_telegram_estados_update_anon" on public.ci_telegram_estados;
drop policy if exists "ci_telegram_estados_delete_anon" on public.ci_telegram_estados;

create policy "ci_telegram_estados_select_anon"
  on public.ci_telegram_estados for select to anon using (true);
create policy "ci_telegram_estados_insert_anon"
  on public.ci_telegram_estados for insert to anon with check (true);
create policy "ci_telegram_estados_update_anon"
  on public.ci_telegram_estados for update to anon using (true) with check (true);
create policy "ci_telegram_estados_delete_anon"
  on public.ci_telegram_estados for delete to anon using (true);

notify pgrst, 'reload schema';
