-- Precio unitario de venta Lulo (ObraApun.PreUni) por partida de obra.
alter table public.partidas
  add column if not exists precio_unitario numeric(12, 4) not null default 0;

comment on column public.partidas.precio_unitario is
  'Precio unitario presupuestado Lulo (P.U. venta con márgenes).';
