-- Enlace opcional entre inventario (global_inventory) y catálogo comercial (products).
-- Permite mostrar la foto del producto sin depender del nombre ni de image_url.

alter table public.global_inventory
  add column if not exists product_id bigint references public.products (id) on delete set null;

create index if not exists idx_global_inventory_product_id
  on public.global_inventory (product_id)
  where product_id is not null;

comment on column public.global_inventory.product_id is 'FK opcional a products(id); foto y referencia comercial.';
