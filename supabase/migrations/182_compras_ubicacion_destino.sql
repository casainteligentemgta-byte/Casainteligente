-- Ubicación de ingreso para compras (Telegram y recepción mercancía).

alter table public.ci_facturas_canal_pendientes
  add column if not exists ubicacion_destino_id uuid
  references public.inv_ubicaciones (id) on delete set null;

create index if not exists idx_ci_facturas_canal_ubicacion
  on public.ci_facturas_canal_pendientes (ubicacion_destino_id)
  where ubicacion_destino_id is not null;

alter table public.purchase_invoices
  add column if not exists ubicacion_destino_id uuid
  references public.inv_ubicaciones (id) on delete set null;

comment on column public.ci_facturas_canal_pendientes.ubicacion_destino_id is
  'Almacén u obra donde ingresará el material al confirmar la compra.';

notify pgrst, 'reload schema';
