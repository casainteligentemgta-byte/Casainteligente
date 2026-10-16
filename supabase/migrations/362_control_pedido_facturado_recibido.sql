-- 362 · Control de compras: lo pedido contra lo facturado contra lo recibido.
--
-- Una fila por diferencia encontrada en una factura de compra:
--   facturado_mayor_pedido   la factura cobra más cantidad que la que pidió la procura
--   no_pedido                la factura trae un material que ninguna procura pidió
--   recibido_menor_facturado al almacén llegó menos de lo que se facturó
--
-- La calcula lib/compras/controlCompra.ts al confirmar la factura y al cerrar la
-- recepción; se avisa por Telegram y se marca «revisada» desde el centro de compras.

create table if not exists public.ci_control_compras (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references public.purchase_invoices (id) on delete cascade,
  procura_id uuid references public.ci_procuras (id) on delete set null,
  proyecto_id uuid,
  tipo text not null check (tipo in ('facturado_mayor_pedido', 'no_pedido', 'recibido_menor_facturado')),
  clave text not null,
  material_id uuid,
  descripcion text not null,
  unidad text,
  cantidad_pedida numeric,
  cantidad_facturada numeric,
  cantidad_recibida numeric,
  precio_unitario numeric,
  moneda text,
  monto_diferencia numeric,
  estado text not null default 'abierta' check (estado in ('abierta', 'revisada')),
  revisada_por text,
  revisada_at timestamptz,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_invoice_id, clave)
);

comment on table public.ci_control_compras is
  'Diferencias pedido / facturado / recibido por factura de compra. Migración 362.';

create index if not exists idx_ci_control_compras_abiertas
  on public.ci_control_compras (created_at desc) where estado = 'abierta';

alter table public.ci_control_compras enable row level security;

create policy ci_control_compras_lectura on public.ci_control_compras
  for select to authenticated using (true);

grant select on public.ci_control_compras to authenticated;
grant all on public.ci_control_compras to service_role;
