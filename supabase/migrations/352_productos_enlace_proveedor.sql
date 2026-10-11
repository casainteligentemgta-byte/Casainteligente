-- Enlace del producto en la web del proveedor: de ahí se lee su precio para actualizar el costo.
alter table public.products add column if not exists proveedor_url text;

comment on column public.products.proveedor_url is
  'Dirección de la página de este producto en la web del proveedor (solo proveedores admitidos en lib/productos/precioProveedorWeb.ts). Se usa en Productos → Actualizar costos del proveedor.';
