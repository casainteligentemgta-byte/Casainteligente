-- Monto total presupuestado Lulo (ObraApun.STotPar) por partida.
alter table public.partidas
  add column if not exists monto_total numeric(15, 2) not null default 0;

comment on column public.partidas.monto_total is
  'Monto total presupuestado Lulo (cantidad × P.U. o STotPar).';
