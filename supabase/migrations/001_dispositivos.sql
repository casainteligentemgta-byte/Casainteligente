-- Tabla de dispositivos para Casa Inteligente
-- Ejecuta este script en Supabase: SQL Editor → New query → Pegar → Run

create table if not exists public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('luz', 'termostato', 'sensor', 'enchufe', 'cortina', 'otro')),
  habitacion text,
  encendido boolean default false,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

-- Índices para listados y filtros
create index if not exists idx_dispositivos_tipo on public.dispositivos (tipo);
create index if not exists idx_dispositivos_habitacion on public.dispositivos (habitacion);

-- Permitir lectura e inserción/actualización vía API (anon key)
-- Cuando añadas autenticación, sustituye por políticas por usuario
alter table public.dispositivos enable row level security;

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

-- Trigger para actualizar actualizado_en
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

-- Datos de ejemplo (opcional; ejecuta solo una vez o borra estas líneas)
-- insert into public.dispositivos (nombre, tipo, habitacion, encendido)
-- values
--   ('Luz salón', 'luz', 'Salón', true),
--   ('Luz cocina', 'luz', 'Cocina', false),
--   ('Termostato', 'termostato', 'Salón', true);
