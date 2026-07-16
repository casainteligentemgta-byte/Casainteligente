-- Vincular egreso Telegram (/salida) con transferencia de inventario y trazabilidad OCR.

alter table public.ci_obra_movimientos_material
  add column if not exists transferencia_id uuid
    references public.transferencias_inventario (id) on delete set null;

alter table public.ci_obra_movimientos_material
  add column if not exists stock_aplicado boolean not null default false;

alter table public.ci_obra_movimientos_material
  add column if not exists lineas_extraidas jsonb;

create index if not exists idx_ci_obra_movimientos_transferencia
  on public.ci_obra_movimientos_material (transferencia_id)
  where transferencia_id is not null;

comment on column public.ci_obra_movimientos_material.transferencia_id is
  'Transferencia de inventario generada al egresar material desde Telegram.';
comment on column public.ci_obra_movimientos_material.stock_aplicado is
  'true si se descontó stock vía transferencias_inventario (OCR + almacén origen).';
comment on column public.ci_obra_movimientos_material.lineas_extraidas is
  'Ítems OCR y matching a global_inventory (auditoría depositario).';

notify pgrst, 'reload schema';
