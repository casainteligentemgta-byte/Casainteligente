-- Tabla de productos para Casa Inteligente
-- Ejecuta en Supabase: SQL Editor → New query → Pegar → Run

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio numeric(14,2) not null check (precio >= 0),
  activo boolean default true,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

create index if not exists idx_productos_nombre on public.productos (nombre);

alter table public.productos enable row level security;

create policy "Permitir leer productos"
  on public.productos for select to anon using (true);

create policy "Permitir insertar productos"
  on public.productos for insert to anon with check (true);

create policy "Permitir actualizar productos"
  on public.productos for update to anon using (true) with check (true);

create policy "Permitir borrar productos"
  on public.productos for delete to anon using (true);

create or replace function public.actualizar_actualizado_en_productos()
returns trigger as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_productos_actualizado on public.productos;
create trigger tr_productos_actualizado
  before update on public.productos
  for each row execute function public.actualizar_actualizado_en_productos();

