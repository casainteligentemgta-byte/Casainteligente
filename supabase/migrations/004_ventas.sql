-- Tablas de ventas para Casa Inteligente
-- Ejecuta en Supabase: SQL Editor → New query → Pegar → Run

-- Cabecera de venta
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  fecha date not null default current_date,
  importe_total numeric(14,2) not null check (importe_total >= 0),
  estado text not null check (estado in ('pendiente', 'pagada', 'cancelada')),
  notas text,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

create index if not exists idx_ventas_empresa_fecha on public.ventas (empresa_id, fecha desc);

alter table public.ventas enable row level security;

create policy "Permitir leer ventas"
  on public.ventas for select to anon using (true);

create policy "Permitir insertar ventas"
  on public.ventas for insert to anon with check (true);

create policy "Permitir actualizar ventas"
  on public.ventas for update to anon using (true) with check (true);

create policy "Permitir borrar ventas"
  on public.ventas for delete to anon using (true);

create or replace function public.actualizar_actualizado_en_ventas()
returns trigger as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_ventas_actualizado on public.ventas;
create trigger tr_ventas_actualizado
  before update on public.ventas
  for each row execute function public.actualizar_actualizado_en_ventas();


-- Líneas de venta (detalle)
create table if not exists public.venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  cantidad numeric(14,3) not null check (cantidad > 0),
  precio_unitario numeric(14,2) not null check (precio_unitario >= 0),
  subtotal numeric(14,2) not null check (subtotal >= 0)
);

create index if not exists idx_venta_items_venta on public.venta_items (venta_id);
create index if not exists idx_venta_items_producto on public.venta_items (producto_id);

alter table public.venta_items enable row level security;

create policy "Permitir leer venta_items"
  on public.venta_items for select to anon using (true);

create policy "Permitir insertar venta_items"
  on public.venta_items for insert to anon with check (true);

create policy "Permitir actualizar venta_items"
  on public.venta_items for update to anon using (true) with check (true);

create policy "Permitir borrar venta_items"
  on public.venta_items for delete to anon using (true);

