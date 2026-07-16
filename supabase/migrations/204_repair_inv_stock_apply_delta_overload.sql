-- PostgREST (PGRST203) no puede elegir entre dos overloads de inv_stock_apply_delta
-- (5 params migr. 180/197 vs 10 params migr. 203). Conservar solo la versión con ledger.

drop function if exists public.inv_stock_apply_delta(
  uuid,
  uuid,
  numeric,
  numeric,
  numeric
);

notify pgrst, 'reload schema';
