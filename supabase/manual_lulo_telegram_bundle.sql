-- Pegar y ejecutar en Supabase → SQL Editor (orden: 146 y 149 si faltan, luego este archivo).

-- === 151 ci_lulo_import_snapshots ===
create table if not exists public.ci_lulo_import_snapshots (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  nombre_archivo text not null default '',
  formato text not null check (formato in ('mdb', 'csv')),
  resumen jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ci_lulo_snapshots_proyecto
  on public.ci_lulo_import_snapshots (proyecto_id, created_at desc);
alter table public.ci_lulo_import_snapshots enable row level security;
drop policy if exists "ci_lulo_snapshots_select_anon" on public.ci_lulo_import_snapshots;
drop policy if exists "ci_lulo_snapshots_insert_anon" on public.ci_lulo_import_snapshots;
drop policy if exists "ci_lulo_snapshots_update_anon" on public.ci_lulo_import_snapshots;
drop policy if exists "ci_lulo_snapshots_delete_anon" on public.ci_lulo_import_snapshots;
create policy "ci_lulo_snapshots_select_anon" on public.ci_lulo_import_snapshots for select to anon using (true);
create policy "ci_lulo_snapshots_insert_anon" on public.ci_lulo_import_snapshots for insert to anon with check (true);
create policy "ci_lulo_snapshots_update_anon" on public.ci_lulo_import_snapshots for update to anon using (true) with check (true);
create policy "ci_lulo_snapshots_delete_anon" on public.ci_lulo_import_snapshots for delete to anon using (true);

-- === 152 ci_facturas_canal_pendientes ===
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
create index if not exists idx_ci_facturas_canal_estado on public.ci_facturas_canal_pendientes (estado, created_at desc);
create index if not exists idx_ci_facturas_canal_chat on public.ci_facturas_canal_pendientes (canal, chat_id);
alter table public.ci_facturas_canal_pendientes enable row level security;
drop policy if exists "ci_facturas_canal_select_anon" on public.ci_facturas_canal_pendientes;
drop policy if exists "ci_facturas_canal_insert_anon" on public.ci_facturas_canal_pendientes;
drop policy if exists "ci_facturas_canal_update_anon" on public.ci_facturas_canal_pendientes;
drop policy if exists "ci_facturas_canal_delete_anon" on public.ci_facturas_canal_pendientes;
create policy "ci_facturas_canal_select_anon" on public.ci_facturas_canal_pendientes for select to anon using (true);
create policy "ci_facturas_canal_insert_anon" on public.ci_facturas_canal_pendientes for insert to anon with check (true);
create policy "ci_facturas_canal_update_anon" on public.ci_facturas_canal_pendientes for update to anon using (true) with check (true);
create policy "ci_facturas_canal_delete_anon" on public.ci_facturas_canal_pendientes for delete to anon using (true);

notify pgrst, 'reload schema';
