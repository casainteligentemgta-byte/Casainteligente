-- La categoría «C.C.T.V» pasa a llamarse «CCTV». Se puede volver a ejecutar sin efecto.
update public.product_categories
set name = 'CCTV'
where parent_id is null and lower(trim(name)) = 'c.c.t.v';

update public.products
set categoria = 'CCTV'
where lower(trim(categoria)) = 'c.c.t.v';

-- Subcategoría para los servicios de cámaras (instalación, revisión, reubicación).
insert into public.product_categories (name, kind, sort_order, parent_id)
select 'Servicios', 'comercial', 50, madre.id
from public.product_categories madre
where madre.parent_id is null and lower(trim(madre.name)) = 'cctv'
  and not exists (
    select 1 from public.product_categories c
    where c.parent_id = madre.id and lower(trim(c.name)) = 'servicios'
  );
