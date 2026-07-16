-- Tabla de personas (clientes físicos) para Casa Inteligente
-- Ejecuta en Supabase: SQL Editor → New query → Pegar → Run

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellidos text,
  documento text,
  direccion text,
  ciudad text,
  codigo_postal text,
  telefono text,
  email text,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

create index if not exists idx_personas_nombre on public.personas (nombre);

alter table public.personas enable row level security;

create policy "Permitir leer personas"
  on public.personas for select to anon using (true);

create policy "Permitir insertar personas"
  on public.personas for insert to anon with check (true);

create policy "Permitir actualizar personas"
  on public.personas for update to anon using (true) with check (true);

create policy "Permitir borrar personas"
  on public.personas for delete to anon using (true);

create or replace function public.actualizar_actualizado_en_personas()
returns trigger as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_personas_actualizado on public.personas;
create trigger tr_personas_actualizado
  before update on public.personas
  for each row execute function public.actualizar_actualizado_en_personas();
