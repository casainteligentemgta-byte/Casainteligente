-- Catálogo de productos: unir las categorías que estaban dos veces, con y sin acento.
--
-- «Cámaras Analogas», «Cercos Electricos» y «Domotica» eran las mismas que «Cámaras
-- Análogas», «Cercos Eléctricos» y «Domótica». Sus 25 productos pasan a la categoría con
-- acento (la de base) y las tres repetidas, ya vacías, se quitan.
--
-- El paso 1 ya se aplicó el 11-oct-2026. El paso 2 (borrar las tres filas vacías) queda
-- para ejecutar en Supabase → SQL Editor; mientras tanto la aplicación ya no las muestra,
-- porque compara los nombres sin distinguir acentos (lib/productos/categoriasCatalogo.ts).
--
-- Idempotente: una segunda ejecución no encuentra nada que cambiar.

-- 1) Productos a la categoría con acento.
update public.products
set categoria = case categoria
  when 'Cámaras Analogas' then 'Cámaras Análogas'
  when 'Cercos Electricos' then 'Cercos Eléctricos'
  when 'Domotica' then 'Domótica'
end
where categoria in ('Cámaras Analogas', 'Cercos Electricos', 'Domotica');

-- 2) Quitar las repetidas, solo si quedaron sin productos.
delete from public.product_categories c
where c.name in ('Cámaras Analogas', 'Cercos Electricos', 'Domotica')
  and c.kind = 'personalizada'
  and not exists (select 1 from public.products p where p.categoria = c.name);
