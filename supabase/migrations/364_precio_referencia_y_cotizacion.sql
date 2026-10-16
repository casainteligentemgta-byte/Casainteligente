-- 364 · Precio de referencia y «en cotización».
--
-- ci_control_compras: tipo nuevo 'precio_alto' (se pagó más de 15 % sobre el precio
-- histórico del material, comparado en USD) y la referencia usada.
-- ci_procuras: el comprador marca que está cotizando; la Torre de Control le da más
-- plazo y muestra quién la trabaja.

alter table public.ci_control_compras drop constraint if exists ci_control_compras_tipo_check;
alter table public.ci_control_compras add constraint ci_control_compras_tipo_check
  check (tipo in ('facturado_mayor_pedido', 'no_pedido', 'recibido_menor_facturado', 'precio_alto'));

alter table public.ci_control_compras add column if not exists precio_referencia numeric;

alter table public.ci_procuras add column if not exists cotizando_at timestamptz;
alter table public.ci_procuras add column if not exists cotizando_por text;

comment on column public.ci_procuras.cotizando_at is
  'El comprador marcó «Estoy cotizando» (Telegram). Migración 364.';
