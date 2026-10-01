-- Historial de producción / Preview (versión 002).
-- Esquema alineado con 004/008 para no bloquear installs nuevas.
-- No crea políticas: las define 008_empresas.sql.

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  telefono text,
  email text,
  rif text,
  notas text,
  cif text,
  ciudad text,
  codigo_postal text,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

create index if not exists idx_empresas_nombre on public.empresas (nombre);

alter table public.empresas
  add column if not exists rif text,
  add column if not exists notas text,
  add column if not exists cif text,
  add column if not exists ciudad text,
  add column if not exists codigo_postal text;
