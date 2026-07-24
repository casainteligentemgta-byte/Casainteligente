-- Líneas de factura: descripción del artículo comprado (no solo FK a inventario previo).

alter table public.purchase_details
  add column if not exists description text,
  add column if not exists item_code text;

comment on column public.purchase_details.description is 'Descripción del artículo según la factura de compra.';
comment on column public.purchase_details.item_code is 'Código o referencia del proveedor en la factura.';

alter table public.quality_inspections
  add column if not exists line_description text;

comment on column public.quality_inspections.line_description is 'Copia de la descripción de la línea de factura para cuarentena.';
