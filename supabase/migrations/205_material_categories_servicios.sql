-- Categoría «Servicios» para facturas de compra (mano de obra, fletes, etc.).

insert into public.material_categories (name, parent_id, level)
select 'Servicios', null, 1
where not exists (
  select 1 from public.material_categories c
  where lower(trim(c.name)) = lower('Servicios')
);

notify pgrst, 'reload schema';
