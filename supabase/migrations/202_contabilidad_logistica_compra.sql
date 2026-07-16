-- Puente contabilidad ↔ inventario y flags de cuarentena/rechazo.

alter table public.contabilidad_compras
  add column if not exists compra_factura_id uuid
    references public.compras_facturas (id) on delete set null;

alter table public.contabilidad_compras
  add column if not exists ingresado_almacen_at timestamptz;

alter table public.contabilidad_compras
  add column if not exists cuarentena_rechazo_total boolean not null default false;

create index if not exists idx_contabilidad_compras_compra_factura
  on public.contabilidad_compras (compra_factura_id)
  where compra_factura_id is not null;

comment on column public.contabilidad_compras.compra_factura_id is
  'Factura de inventario (compras_facturas) generada al liberar cuarentena o ingreso directo.';
comment on column public.contabilidad_compras.ingresado_almacen_at is
  'Primera vez que al menos una línea ingresó a inventario_stock vía compras_facturas.';
comment on column public.contabilidad_compras.cuarentena_rechazo_total is
  'True si todas las inspecciones de la factura quedaron RECHAZADO (sin stock ingresado).';

notify pgrst, 'reload schema';
