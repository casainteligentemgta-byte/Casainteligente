-- Ganancia guardada de los presupuestos: la mano de obra tenía como costo su precio de
-- catálogo, muy por encima de lo que se cobraba en cada presupuesto, así que cada uno
-- aparecía con miles de dólares de pérdida que no existían.
--
-- Regla del dueño (15-oct-2026): el costo de un servicio es, por lo general, la mitad de lo
-- que se cobra. Se aplica a esos renglones de mano de obra y se recalculan los totales.
-- Respaldo previo en respaldo.budgets_ganancia_20261015. Ya aplicado en producción.

create schema if not exists respaldo;
revoke all on schema respaldo from anon, authenticated;

create table if not exists respaldo.budgets_ganancia_20261015 as
select id, numero_correlativo, status, items, subtotal, total_cost, total_profit, margin_pct, updated_at, now() as respaldado
from public.budgets
where exists (
  select 1 from jsonb_array_elements(items) i
  where (i->>'product_id') in ('223', '147', '230', '215', '200', '199')
);

-- Renglones de mano de obra cuyo costo guardado era igual o mayor que lo cobrado: costo = mitad de lo cobrado.
with corregidos as (
  select b.id,
    (select jsonb_agg(
       case
         when (e.i->>'product_id') in ('223', '147', '230', '215', '200', '199')
          and coalesce((e.i->'product_data'->>'costo')::numeric, 0) >= (e.i->>'unit_price')::numeric * (1 - coalesce((e.i->>'discount')::numeric, 0) / 100)
         then jsonb_set(e.i, '{product_data,costo}', to_jsonb(round((e.i->>'unit_price')::numeric * (1 - coalesce((e.i->>'discount')::numeric, 0) / 100) / 2, 2)))
         else e.i
       end order by e.ord)
     from jsonb_array_elements(b.items) with ordinality as e(i, ord)) as items_nuevos
  from public.budgets b
  where b.id in (select id from respaldo.budgets_ganancia_20261015)
), con_costo as (
  select c.id, c.items_nuevos,
    (select round(sum(coalesce((x->'product_data'->>'costo')::numeric, 0) * (x->>'qty')::numeric), 2) from jsonb_array_elements(c.items_nuevos) x) as costo_total
  from corregidos c
)
update public.budgets b
set items = k.items_nuevos,
    total_cost = k.costo_total,
    total_profit = round(b.subtotal - k.costo_total, 2),
    margin_pct = case when b.subtotal > 0 then round((b.subtotal - k.costo_total) / b.subtotal * 100, 2) else 0 end
from con_costo k
where b.id = k.id and b.items is distinct from k.items_nuevos;

-- Catálogo: esos servicios pasan a costo = mitad del precio (y a «Servicio» si no tenían categoría).
update public.products
set costo = round(precio / 2, 2),
    utilidad = round(precio - round(precio / 2, 2), 2),
    categoria = case when categoria is null or trim(categoria) = '' then 'Servicio' else categoria end,
    modificado = now()
where id in (223, 230, 215) and precio > 0 and costo >= precio;
