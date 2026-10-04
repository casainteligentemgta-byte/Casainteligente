-- Historial de producción / Preview (versión 001).
-- Se restauró porque el check de Supabase Preview exige que toda
-- versión remota exista como archivo local.

create table if not exists public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('luz', 'termostato', 'sensor', 'enchufe', 'cortina', 'otro')),
  habitacion text,
  encendido boolean default false,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

create index if not exists idx_dispositivos_tipo on public.dispositivos (tipo);
create index if not exists idx_dispositivos_habitacion on public.dispositivos (habitacion);

alter table public.dispositivos enable row level security;

drop policy if exists "Permitir leer dispositivos" on public.dispositivos;
drop policy if exists "Permitir insertar dispositivos" on public.dispositivos;
drop policy if exists "Permitir actualizar dispositivos" on public.dispositivos;
drop policy if exists "Permitir borrar dispositivos" on public.dispositivos;

create policy "Permitir leer dispositivos"
  on public.dispositivos for select
  to anon
  using (true);

create policy "Permitir insertar dispositivos"
  on public.dispositivos for insert
  to anon
  with check (true);

create policy "Permitir actualizar dispositivos"
  on public.dispositivos for update
  to anon
  using (true)
  with check (true);

create policy "Permitir borrar dispositivos"
  on public.dispositivos for delete
  to anon
  using (true);

create or replace function public.actualizar_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_dispositivos_actualizado on public.dispositivos;
create trigger tr_dispositivos_actualizado
  before update on public.dispositivos
  for each row execute function public.actualizar_actualizado_en();
