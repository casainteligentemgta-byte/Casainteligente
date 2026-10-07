-- Productos: lo que dice la lista de precios del proveedor.
--  · disponibilidad_proveedor: si el proveedor lo tiene ('disponible',
--    'no_disponible', 'en_transito') según la última lista importada.
--  · lista_proveedor_fecha: fecha de esa lista.
-- Solo estructura: los precios no se guardan en el repositorio; los sube el
-- dueño desde Productos → «Importar lista de precios».
alter table public.products
  add column if not exists disponibilidad_proveedor text,
  add column if not exists lista_proveedor_fecha date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_disponibilidad_proveedor_valida'
  ) then
    alter table public.products
      add constraint products_disponibilidad_proveedor_valida
      check (
        disponibilidad_proveedor is null
        or disponibilidad_proveedor in ('disponible', 'no_disponible', 'en_transito')
      );
  end if;
end $$;

comment on column public.products.disponibilidad_proveedor is
  'Disponibilidad según la última lista del proveedor: disponible, no_disponible o en_transito.';
comment on column public.products.lista_proveedor_fecha is
  'Fecha de la lista del proveedor con la que se revisó el producto por última vez.';
