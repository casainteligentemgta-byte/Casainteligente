-- Una factura (contabilidad_compras / purchase_invoice) puede cubrir varias procuras.
-- Nota: esta migración ya no crea la tabla puente ci_procura_factura_vinculos.
-- Esa tabla nunca existió en producción; el vínculo procura↔factura se guarda en
-- ci_procuras.purchase_invoice_id y contabilidad_compras.procura_id.

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
  'Enlaza procura↔factura por ci_procuras.purchase_invoice_id y contabilidad_compras.procura_id.';
