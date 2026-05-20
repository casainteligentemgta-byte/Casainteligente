-- Facturas recibidas por Telegram (borrador hasta confirmar en la app).

create table if not exists public.ci_facturas_canal_pendientes (
  id uuid primary key default gen_random_uuid(),
  canal text not null default 'telegram' check (canal in ('telegram', 'whatsapp')),
  chat_id text not null,
  chat_label text,
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesando', 'extraido', 'confirmado', 'rechazado', 'error')),
  document_storage_path text,
  document_file_name text,
  document_mime_type text,
  extracted jsonb,
  mensaje_error text,
  purchase_invoice_id uuid references public.purchase_invoices (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_facturas_canal_estado
  on public.ci_facturas_canal_pendientes (estado, created_at desc);

create index if not exists idx_ci_facturas_canal_chat
  on public.ci_facturas_canal_pendientes (canal, chat_id);

comment on table public.ci_facturas_canal_pendientes is
  'Facturas enviadas por foto (Telegram/WhatsApp) pendientes de confirmación en procurement.';

alter table public.ci_facturas_canal_pendientes enable row level security;

drop policy if exists "ci_facturas_canal_select_anon" on public.ci_facturas_canal_pendientes;
drop policy if exists "ci_facturas_canal_insert_anon" on public.ci_facturas_canal_pendientes;
drop policy if exists "ci_facturas_canal_update_anon" on public.ci_facturas_canal_pendientes;
drop policy if exists "ci_facturas_canal_delete_anon" on public.ci_facturas_canal_pendientes;

create policy "ci_facturas_canal_select_anon"
  on public.ci_facturas_canal_pendientes for select to anon using (true);
create policy "ci_facturas_canal_insert_anon"
  on public.ci_facturas_canal_pendientes for insert to anon with check (true);
create policy "ci_facturas_canal_update_anon"
  on public.ci_facturas_canal_pendientes for update to anon using (true) with check (true);
create policy "ci_facturas_canal_delete_anon"
  on public.ci_facturas_canal_pendientes for delete to anon using (true);

notify pgrst, 'reload schema';
