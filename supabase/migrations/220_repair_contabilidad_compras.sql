-- Reparación idempotente: columnas y políticas de compras contables (138, 183, 196, 202, 219).

-- 138: proyecto en compras
alter table public.purchase_invoices
  add column if not exists proyecto_id uuid references public.ci_proyectos(id) on delete set null;

alter table public.contabilidad_compras
  add column if not exists proyecto_id uuid references public.ci_proyectos(id) on delete set null;

create index if not exists idx_purchase_invoices_proyecto
  on public.purchase_invoices (proyecto_id);

create index if not exists idx_contabilidad_compras_proyecto
  on public.contabilidad_compras (proyecto_id);

-- 183: almacén destino en contabilidad
alter table public.contabilidad_compras
  add column if not exists ubicacion_destino_id uuid
    references public.inv_ubicaciones (id) on delete set null;

create index if not exists idx_contabilidad_compras_ubicacion
  on public.contabilidad_compras (ubicacion_destino_id)
  where ubicacion_destino_id is not null;

-- 196: entidad
alter table public.contabilidad_compras
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

alter table public.purchase_invoices
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

create index if not exists idx_contabilidad_compras_entidad
  on public.contabilidad_compras (entidad_id)
  where entidad_id is not null;

-- 202: puente logística
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

-- 219: imputación obra vs entidad
alter table public.contabilidad_compras
  add column if not exists imputacion text not null default 'obra'
    check (imputacion in ('obra', 'entidad'));

create index if not exists idx_contabilidad_compras_imputacion
  on public.contabilidad_compras (imputacion, proyecto_id)
  where imputacion = 'entidad';

-- Vista valuación AD (219)
create or replace view public.ci_compras as
select
  id,
  proyecto_id,
  total_amount as monto_total,
  fecha as fecha_factura,
  valuacion_delegada_id
from public.contabilidad_compras
where coalesce(imputacion, 'obra') = 'obra'
  and proyecto_id is not null;

-- 138: políticas DELETE (idempotentes)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contabilidad_compras'
      and policyname = 'Permitir borrar contabilidad_compras anon'
  ) then
    create policy "Permitir borrar contabilidad_compras anon"
      on public.contabilidad_compras for delete to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contabilidad_compras'
      and policyname = 'Permitir borrar contabilidad_compras authenticated'
  ) then
    create policy "Permitir borrar contabilidad_compras authenticated"
      on public.contabilidad_compras for delete to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contabilidad_compra_lineas'
      and policyname = 'Permitir borrar contabilidad_compra_lineas anon'
  ) then
    create policy "Permitir borrar contabilidad_compra_lineas anon"
      on public.contabilidad_compra_lineas for delete to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contabilidad_compra_lineas'
      and policyname = 'Permitir borrar contabilidad_compra_lineas authenticated'
  ) then
    create policy "Permitir borrar contabilidad_compra_lineas authenticated"
      on public.contabilidad_compra_lineas for delete to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'purchase_invoices'
      and policyname = 'Permitir borrar purchase_invoices anon'
  ) then
    create policy "Permitir borrar purchase_invoices anon"
      on public.purchase_invoices for delete to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'purchase_invoices'
      and policyname = 'Permitir borrar purchase_invoices authenticated'
  ) then
    create policy "Permitir borrar purchase_invoices authenticated"
      on public.purchase_invoices for delete to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'purchase_details'
      and policyname = 'Permitir borrar purchase_details anon'
  ) then
    create policy "Permitir borrar purchase_details anon"
      on public.purchase_details for delete to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'purchase_details'
      and policyname = 'Permitir borrar purchase_details authenticated'
  ) then
    create policy "Permitir borrar purchase_details authenticated"
      on public.purchase_details for delete to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quality_inspections'
      and policyname = 'Permitir borrar quality_inspections anon'
  ) then
    create policy "Permitir borrar quality_inspections anon"
      on public.quality_inspections for delete to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quality_inspections'
      and policyname = 'Permitir borrar quality_inspections authenticated'
  ) then
    create policy "Permitir borrar quality_inspections authenticated"
      on public.quality_inspections for delete to authenticated using (true);
  end if;
end $$;

notify pgrst, 'reload schema';
