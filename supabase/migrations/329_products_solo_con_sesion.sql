-- Catálogo de productos: quedaba abierto a cualquiera con la clave pública
-- (leer costos y precios, crear, editar y borrar sin iniciar sesión).
-- Ahora las políticas de `products` y `product_categories` solo aplican a
-- usuarios con sesión; las páginas /productos y /ventas ya piden sesión.
-- No se borra ninguna política: se les cambia el rol (reversible).
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('products', 'product_categories')
      and (roles && array['public', 'anon']::name[])
  loop
    execute format('alter policy %I on %I.%I to authenticated', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'Permitir borrar productos a anónimos') then
    alter policy "Permitir borrar productos a anónimos" on public.products rename to "products_borrar_con_sesion";
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'Permitir editar productos a anónimos') then
    alter policy "Permitir editar productos a anónimos" on public.products rename to "products_editar_con_sesion";
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'Permitir insertar productos a anónimos') then
    alter policy "Permitir insertar productos a anónimos" on public.products rename to "products_insertar_con_sesion";
  end if;
end $$;

-- Sin sesión solo queda el permiso de lectura (que RLS deja en cero filas).
revoke insert, update, delete, truncate, references, trigger on public.products from anon;
revoke insert, update, delete, truncate, references, trigger on public.product_categories from anon;
