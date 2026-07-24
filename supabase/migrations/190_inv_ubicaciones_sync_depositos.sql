-- Sincroniza inv_ubicaciones con inventory_deposits:
-- 1) Backfill depósitos creados después de migr. 180 (ej. TERRENO JC)
-- 2) Corrige tipo: depósitos físicos son almacen_central, no almacen_movil
-- 3) Trigger para futuros altas/ediciones en Maestros

-- Backfill faltantes
insert into public.inv_ubicaciones (codigo, nombre, tipo, deposit_id)
select
  'DEP-' || d.code,
  d.name,
  'almacen_central',
  d.id
from public.inventory_deposits d
where not exists (
  select 1 from public.inv_ubicaciones u where u.deposit_id = d.id
);

-- Depósitos físicos ≠ almacén móvil (camioneta/caja herramientas)
update public.inv_ubicaciones
set
  tipo = 'almacen_central',
  updated_at = now()
where deposit_id is not null
  and tipo = 'almacen_movil';

-- Sincronizar al crear o editar depósito
create or replace function public.inv_sync_ubicacion_deposito()
returns trigger
language plpgsql
as $$
begin
  insert into public.inv_ubicaciones (codigo, nombre, tipo, deposit_id, activo)
  values (
    'DEP-' || NEW.code,
    NEW.name,
    'almacen_central',
    NEW.id,
    true
  )
  on conflict (codigo) do update set
    nombre = EXCLUDED.nombre,
    deposit_id = EXCLUDED.deposit_id,
    tipo = 'almacen_central',
    activo = true,
    updated_at = now();

  return NEW;
end;
$$;

drop trigger if exists tr_inv_sync_ubicacion_deposito on public.inventory_deposits;
create trigger tr_inv_sync_ubicacion_deposito
  after insert or update of code, name on public.inventory_deposits
  for each row
  execute function public.inv_sync_ubicacion_deposito();

comment on function public.inv_sync_ubicacion_deposito() is
  'Mantiene inv_ubicaciones alineada con inventory_deposits (Maestros de almacén).';
