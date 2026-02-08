-- Tabla de empresas para Casa Inteligente
-- Ejecuta en Supabase: SQL Editor → New query → Pegar → Run

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cif text,
  direccion text,
  ciudad text,
  codigo_postal text,
  telefono text,
  email text,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

create index if not exists idx_empresas_nombre on public.empresas (nombre);

alter table public.empresas enable row level security;

create policy "Permitir leer empresas"
  on public.empresas for select to anon using (true);

create policy "Permitir insertar empresas"
  on public.empresas for insert to anon with check (true);

create policy "Permitir actualizar empresas"
  on public.empresas for update to anon using (true) with check (true);

create policy "Permitir borrar empresas"
  on public.empresas for delete to anon using (true);

create or replace function public.actualizar_actualizado_en_empresas()
returns trigger as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_empresas_actualizado on public.empresas;
create trigger tr_empresas_actualizado
  before update on public.empresas
  for each row execute function public.actualizar_actualizado_en_empresas();
