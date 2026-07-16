-- Nexus Home: contratos vinculados a proyecto, PDF almacenado y firma (base64 o URL).
-- No rompe tablas existentes; la app puede adoptar estas tablas progresivamente.

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.projects(id) on delete cascade,
  titulo text,
  version int not null default 1,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviado', 'firmado', 'anulado')),
  pdf_storage_path text,
  pdf_url text,
  -- Firma del cliente (data URL base64 o referencia externa)
  firma_cliente text,
  firmado_en timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contratos_proyecto on public.contratos (proyecto_id);

alter table public.contratos enable row level security;

drop policy if exists "Permitir leer contratos" on public.contratos;
create policy "Permitir leer contratos"
  on public.contratos for select to anon using (true);
drop policy if exists "Permitir insertar contratos" on public.contratos;
create policy "Permitir insertar contratos"
  on public.contratos for insert to anon with check (true);
drop policy if exists "Permitir actualizar contratos" on public.contratos;
create policy "Permitir actualizar contratos"
  on public.contratos for update to anon using (true) with check (true);
drop policy if exists "Permitir borrar contratos" on public.contratos;
create policy "Permitir borrar contratos"
  on public.contratos for delete to anon using (true);

comment on table public.contratos is 'Nexus: contratos por proyecto; pdf en Storage vía pdf_storage_path o pdf_url.';
comment on column public.contratos.firma_cliente is 'Opcional: PNG/SVG base64 data URL o URL firmada.';
