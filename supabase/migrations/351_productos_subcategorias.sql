-- Subcategorías del catálogo.
--
-- Una categoría puede tener hijas (product_categories.parent_id) y el producto guarda la
-- suya en products.subcategoria. «Cámaras IP» y «Cámaras Análogas» dejan de ser categorías
-- sueltas y pasan a ser subcategorías de C.C.T.V, junto con «Otros dispositivos» y
-- «Accesorios». Se puede volver a ejecutar sin efecto.

alter table public.products add column if not exists subcategoria text;

alter table public.product_categories
  add column if not exists parent_id uuid references public.product_categories(id) on delete cascade;

create index if not exists idx_product_categories_parent on public.product_categories (parent_id);
create index if not exists idx_products_categoria_subcategoria on public.products (categoria, subcategoria);

comment on column public.products.subcategoria is
  'Subcategoría dentro de products.categoria (p. ej. C.C.T.V › Cámaras IP). Nombre de una fila de product_categories con parent_id.';
comment on column public.product_categories.parent_id is
  'Si tiene valor, la fila es una subcategoría de esa categoría.';

-- El nombre es único dentro de su categoría madre, no en toda la tabla: «Accesorios»
-- puede existir en C.C.T.V y también en Domótica.
create unique index if not exists idx_product_categories_padre_nombre
  on public.product_categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)));
drop index if exists public.idx_product_categories_name_lower;

-- La categoría que reúne todo.
insert into public.product_categories (name, kind, sort_order, color)
select 'C.C.T.V', 'comercial', 10, '#5856D6'
where not exists (
  select 1 from public.product_categories c where c.parent_id is null and lower(trim(c.name)) = 'c.c.t.v'
);

-- Las dos categorías de cámaras pasan a colgar de C.C.T.V.
update public.product_categories c
set parent_id = madre.id,
    sort_order = case lower(trim(c.name)) when 'cámaras ip' then 10 else 20 end
from public.product_categories madre
where madre.parent_id is null
  and lower(trim(madre.name)) = 'c.c.t.v'
  and c.parent_id is null
  and lower(trim(c.name)) in ('cámaras ip', 'cámaras análogas');

-- Las subcategorías que faltan.
insert into public.product_categories (name, kind, sort_order, parent_id)
select v.name, 'comercial', v.sort_order, madre.id
from (
  values ('Cámaras IP', 10), ('Cámaras Análogas', 20), ('Otros dispositivos', 30), ('Accesorios', 40)
) as v(name, sort_order)
join public.product_categories madre on madre.parent_id is null and lower(trim(madre.name)) = 'c.c.t.v'
where not exists (
  select 1 from public.product_categories c
  where c.parent_id = madre.id and lower(trim(c.name)) = lower(v.name)
);

-- Los productos: su antigua categoría pasa a ser su subcategoría.
update public.products
set subcategoria = case lower(trim(categoria)) when 'cámaras ip' then 'Cámaras IP' else 'Cámaras Análogas' end,
    categoria = 'C.C.T.V'
where lower(trim(categoria)) in ('cámaras ip', 'cámaras análogas');
