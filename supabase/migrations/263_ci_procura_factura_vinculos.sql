-- Una factura (contabilidad_compras / purchase_invoice) puede cubrir varias procuras.

create table if not exists public.ci_procura_factura_vinculos (
  id uuid primary key default gen_random_uuid(),
  procura_id uuid not null references public.ci_procuras (id) on delete cascade,
  contabilidad_compra_id uuid not null references public.contabilidad_compras (id) on delete cascade,
  purchase_invoice_id uuid references public.purchase_invoices (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ci_procura_factura_vinculos_procura_unique unique (procura_id)
);

create index if not exists idx_ci_procura_factura_vinculos_compra
  on public.ci_procura_factura_vinculos (contabilidad_compra_id);

create index if not exists idx_ci_procura_factura_vinculos_pi
  on public.ci_procura_factura_vinculos (purchase_invoice_id)
  where purchase_invoice_id is not null;

comment on table public.ci_procura_factura_vinculos is
  'N procuras → 1 factura contable. Cada procura aparece como máximo en una factura.';

alter table public.ci_procura_factura_vinculos enable row level security;

-- Backfill desde vínculos existentes (procura_id en contabilidad_compras)
insert into public.ci_procura_factura_vinculos (procura_id, contabilidad_compra_id, purchase_invoice_id)
select p.id, cc.id, cc.purchase_invoice_id
from public.ci_procuras p
join public.contabilidad_compras cc on cc.procura_id = p.id
where p.id is not null
on conflict (procura_id) do nothing;

-- Backfill desde purchase_invoice_id en procura sin fila en contabilidad_compras.procura_id
insert into public.ci_procura_factura_vinculos (procura_id, contabilidad_compra_id, purchase_invoice_id)
select p.id, cc.id, p.purchase_invoice_id
from public.ci_procuras p
join public.contabilidad_compras cc on cc.purchase_invoice_id = p.purchase_invoice_id
where p.purchase_invoice_id is not null
  and not exists (
    select 1 from public.ci_procura_factura_vinculos v where v.procura_id = p.id
  )
on conflict (procura_id) do nothing;

create or replace function public.ci_vincular_procura_compra(
  p_purchase_invoice_id uuid,
  p_procura_id uuid default null,
  p_contabilidad_compra_id uuid default null,
  p_auto_match boolean default true
)
returns table (
  procura_id uuid,
  ticket text,
  desviacion_usd numeric,
  vinculado boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pi uuid := p_purchase_invoice_id;
  v_cc record;
  v_procura_id uuid := p_procura_id;
  v_procura public.ci_procuras;
  v_desv numeric;
  v_material uuid;
begin
  if v_pi is null then
    return;
  end if;

  if p_contabilidad_compra_id is not null then
    select * into v_cc
    from public.contabilidad_compras c
    where c.id = p_contabilidad_compra_id
    for update;
  else
    select * into v_cc
    from public.contabilidad_compras c
    where c.purchase_invoice_id = v_pi
    for update;
  end if;

  if not found then
    return;
  end if;

  if v_cc.purchase_invoice_id is not null and v_cc.purchase_invoice_id <> v_pi then
    return;
  end if;

  if v_procura_id is null then
    v_procura_id := v_cc.procura_id;
  end if;

  if v_procura_id is null and p_auto_match then
    select cl.material_id into v_material
    from public.contabilidad_compra_lineas cl
    where cl.compra_id = v_cc.id
      and cl.material_id is not null
    order by cl.created_at
    limit 1;

    select p.id into v_procura_id
    from public.ci_procuras p
    where p.proyecto_id is not distinct from v_cc.proyecto_id
      and p.estado in ('en_compra', 'aprobada', 'aprobada_directa', 'recibida_parcial')
      and (p.purchase_invoice_id is null or p.purchase_invoice_id = v_pi)
      and (
        v_material is null
        or p.material_id is null
        or p.material_id = v_material
      )
    order by
      case when p.purchase_invoice_id = v_pi then 0 else 1 end,
      p.updated_at desc
    limit 1;
  end if;

  if v_procura_id is null then
    return;
  end if;

  select * into v_procura
  from public.ci_procuras p
  where p.id = v_procura_id
  for update;

  if not found then
    return;
  end if;

  if v_procura.purchase_invoice_id is not null and v_procura.purchase_invoice_id <> v_pi then
    return;
  end if;

  update public.ci_procuras p
  set
    purchase_invoice_id = v_pi,
    updated_at = now()
  where p.id = v_procura_id;

  update public.contabilidad_compras c
  set procura_id = coalesce(c.procura_id, v_procura_id)
  where c.id = v_cc.id;

  insert into public.ci_procura_factura_vinculos (
    procura_id,
    contabilidad_compra_id,
    purchase_invoice_id
  )
  values (v_procura_id, v_cc.id, v_pi)
  on conflict (procura_id) do update
  set
    contabilidad_compra_id = excluded.contabilidad_compra_id,
    purchase_invoice_id = excluded.purchase_invoice_id;

  v_desv := public.ci_calcular_desviacion_procura_usd(v_procura_id);

  update public.ci_procuras p
  set desviacion_usd = v_desv
  where p.id = v_procura_id;

  procura_id := v_procura_id;
  ticket := v_procura.ticket;
  desviacion_usd := v_desv;
  vinculado := true;
  return next;
end;
$$;

comment on function public.ci_vincular_procura_compra(uuid, uuid, uuid, boolean) is
  'Enlaza procura↔factura; permite varias procuras en la misma compra contable (tabla puente).';
