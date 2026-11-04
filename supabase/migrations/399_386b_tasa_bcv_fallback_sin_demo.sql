-- Recupera 386b (aplicada en prod como 20261103141220_386b_tasa_bcv_fallback_sin_demo).
-- Idempotente: CREATE OR REPLACE. No reescribe filas.
--
-- 386 quitó la tasa fija antigua y solo leía ci_config_nomina GLOBAL. Si no hay
-- fila GLOBAL (así está prod hoy) cada FRM con monto > 0 fallaba. 386b toma:
--   1) GLOBAL
--   2) última compra contable no-DEMO
--   3) última purchase_invoice no-DEMO
-- Sigue sin inventar una tasa fija.

create or replace function public.ci_tasa_bcv_compra_fallback()
returns numeric
language sql
stable
set search_path to 'public'
as $$
  select coalesce(
    (select c.tasa_bcv_ves_por_usd from public.ci_config_nomina c
      where upper(trim(c.cargo_codigo)) = 'GLOBAL' and c.tasa_bcv_ves_por_usd > 0 limit 1),
    (select cc.tasa_bcv_ves_por_usd from public.contabilidad_compras cc
      where cc.tasa_bcv_ves_por_usd > 0 and coalesce(cc.invoice_number, '') not ilike 'DEMO-%'
      order by cc.created_at desc nulls last limit 1),
    (select pi.tasa_bcv_ves_por_usd from public.purchase_invoices pi
      where pi.tasa_bcv_ves_por_usd > 0 and coalesce(pi.invoice_number, '') not ilike 'DEMO-%'
      order by pi.created_at desc nulls last limit 1)
  );
$$;

comment on function public.ci_tasa_bcv_compra_fallback() is
  'Tasa BCV: GLOBAL, luego última compra/factura no-DEMO. Sin tasa fija. Si todo es null, el caller falla.';
