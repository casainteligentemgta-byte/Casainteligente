-- Fotos y manuales de productos (carpetas `product-media` y `productos`):
-- cualquiera con la clave pública podía subir, reemplazar y borrar archivos.
-- Ahora esas tres operaciones piden sesión. Ver las fotos por su enlace sigue
-- siendo público (aparecen en los presupuestos que recibe el cliente).
-- El formulario público de reclutamiento sube a `ci-proyectos-media`: no cambia.
-- No se borra ninguna política: se les cambia el rol (reversible).
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and (roles && array['anon', 'public']::name[])
      and (
        coalesce(qual, '') ~ '''(product-media|productos)'''
        or coalesce(with_check, '') ~ '''(product-media|productos)'''
      )
  loop
    execute format('alter policy %I on storage.objects to authenticated', p.policyname);
  end loop;
end $$;
