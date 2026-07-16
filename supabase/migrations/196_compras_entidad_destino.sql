-- Entidad de trabajo en compras (denormalizada desde proyecto; facilita filtros y cuadros).

alter table public.contabilidad_compras
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

alter table public.purchase_invoices
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

alter table public.ci_facturas_canal_pendientes
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

create index if not exists idx_contabilidad_compras_entidad
  on public.contabilidad_compras (entidad_id)
  where entidad_id is not null;

create index if not exists idx_purchase_invoices_entidad
  on public.purchase_invoices (entidad_id)
  where entidad_id is not null;

-- Backfill desde proyecto asignado
update public.contabilidad_compras c
set entidad_id = p.entidad_id
from public.ci_proyectos p
where c.proyecto_id = p.id
  and c.entidad_id is null
  and p.entidad_id is not null;

update public.purchase_invoices pi
set entidad_id = p.entidad_id
from public.ci_proyectos p
where pi.proyecto_id = p.id
  and pi.entidad_id is null
  and p.entidad_id is not null;

update public.ci_facturas_canal_pendientes f
set entidad_id = p.entidad_id
from public.ci_proyectos p
where f.proyecto_id = p.id
  and f.entidad_id is null
  and p.entidad_id is not null;

comment on column public.contabilidad_compras.entidad_id is
  'Entidad de trabajo (ci_entidades) a la que se imputa la compra; coherente con proyecto_id.';
comment on column public.contabilidad_compras.ubicacion_destino_id is
  'Almacén u obra donde ingresa el material; vincula stock en inventario_stock.';

notify pgrst, 'reload schema';
