-- Obra y almacén de ingreso en contabilidad (reubicación de compras).

alter table public.contabilidad_compras
  add column if not exists ubicacion_destino_id uuid
  references public.inv_ubicaciones (id) on delete set null;

create index if not exists idx_contabilidad_compras_ubicacion
  on public.contabilidad_compras (ubicacion_destino_id)
  where ubicacion_destino_id is not null;

comment on column public.contabilidad_compras.ubicacion_destino_id is
  'Almacén u obra donde está localizado el material de esta compra.';

notify pgrst, 'reload schema';
