-- 365 · Procura «solo compra».
--
-- Quien pide por /procura y ve que el almacén tiene el material elige: pedirlo al almacén
-- (y comprar solo lo que falte) o comprarlo todo. En ambos casos la procura que se
-- registra es solo de compra: al aprobarla no se vuelve a repartir contra el almacén
-- (antes despachaba otra vez lo que ya se había pedido y no compraba nada).

alter table public.ci_procuras add column if not exists solo_compra boolean not null default false;

comment on column public.ci_procuras.solo_compra is
  'La procura es solo de compra: el almacén no despacha parte de ella. Migración 365.';
