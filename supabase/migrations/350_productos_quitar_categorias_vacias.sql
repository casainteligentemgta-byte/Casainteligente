-- Catálogo de productos: quitar la categoría «Opción 3» y las tres repetidas sin acento.
--
-- Sus productos ya se pasaron a otra categoría el 11-oct-2026:
--   · «Opción 3»: la cámara a «Cámaras IP» y el hub a «Domótica».
--   · «Cámaras Analogas», «Cercos Electricos», «Domotica»: a las de acento (migración 349).
-- Ese mismo día las cámaras que estaban sin categoría o en «C.C.T.V» pasaron a
-- «Cámaras IP» o «Cámaras Análogas» (22 productos; ver docs/PRODUCTOS-IMPORTAR-LISTA-PRECIOS.md).
--
-- Solo borra categorías que ya no tienen ningún producto. Para ejecutar en
-- Supabase → SQL Editor. Idempotente.

delete from public.product_categories c
where c.name in ('Opción 3', 'Cámaras Analogas', 'Cercos Electricos', 'Domotica')
  and not exists (select 1 from public.products p where p.categoria = c.name);
