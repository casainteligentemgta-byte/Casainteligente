-- Depósito por defecto: nombre visible en columna "ubicación" del inventario.
-- Ajuste locality según su sede real (ciudad, zona, dirección corta).

update public.inventory_deposits
set locality = coalesce(nullif(trim(locality), ''), 'Sede principal')
where code = 'OFI' and is_default = true;

comment on column public.inventory_deposits.locality is
  'Localidad o sede del depósito; se muestra en inventario junto al nombre.';
