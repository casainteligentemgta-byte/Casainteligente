-- 379: conciliación de recepción de campo (nota o emergencia) con compra de Procura.
--
-- La IA sugiere el enlace y la persona lo confirma. Reglas:
--  - Solo recepciones registradas de tipo nota_entrega o emergencia.
--  - Una recepción con factura de canal NO se enlaza a Procura (se rechaza).
--  - El enlace solo se permite mientras la compra de Procura siga en borrador.
--    Si ya tiene stock registrado, se rechaza para no duplicarlo.
--  - Misma ubicación y mismo proveedor (por RIF o nombre).
--  - La compra provisional original se guarda en contabilidad_compra_provisional_id (histórico).
--  - Solo cambia el enlace. No toca stock ni cantidades.
--
-- Además restaura la condición de ingreso previo por enlace (la de la 377), que ahora sí
-- tiene un enlace real que la respalda.

alter table public.ci_recepciones_campo
  add column if not exists contabilidad_compra_provisional_id uuid;

comment on column public.ci_recepciones_campo.contabilidad_compra_provisional_id is
  'Compra provisional original de la recepción, conservada como histórico al enlazar con Procura (379).';

create or replace function public.ci_enlazar_frm_con_compra_procura(
  p_recepcion_id uuid,
  p_contabilidad_compra_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_cc record;
  v_cf record;
  v_proveedor_ok boolean;
  v_rif_cc text;
begin
  select * into v_rec
  from public.ci_recepciones_campo r
  where r.id = p_recepcion_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Recepción de campo no encontrada.');
  end if;
  if v_rec.estado is distinct from 'registrado' then
    return jsonb_build_object('success', false, 'error', 'La recepción no está registrada.');
  end if;
  if v_rec.tipo not in ('nota_entrega', 'emergencia') then
    return jsonb_build_object('success', false, 'error', 'Solo se enlazan recepciones de nota o emergencia.');
  end if;
  if v_rec.factura_canal_pendiente_id is not null then
    return jsonb_build_object('success', false,
      'error', 'La recepción ya tiene factura de canal. No se enlaza a Procura.');
  end if;

  select * into v_cc
  from public.contabilidad_compras cc
  where cc.id = p_contabilidad_compra_id
  for update;

  if not found or v_cc.purchase_invoice_id is null then
    return jsonb_build_object('success', false, 'error', 'Compra de Procura no encontrada.');
  end if;

  select * into v_cf
  from public.compras_facturas cf
  where cf.purchase_invoice_id = v_cc.purchase_invoice_id
  for update;

  if v_cf.id is not null and v_cf.estado = 'registrada' then
    return jsonb_build_object('success', false,
      'error', 'La compra de Procura ya tiene stock registrado. No se puede enlazar sin duplicarlo.');
  end if;

  if v_cf.id is not null and v_cf.ubicacion_destino_id is distinct from v_rec.ubicacion_id then
    return jsonb_build_object('success', false,
      'error', 'La ubicación de la compra de Procura no coincide con la de la recepción.');
  end if;

  v_rif_cc := regexp_replace(upper(coalesce(v_cc.supplier_rif, '')), '[\s.-]', '', 'g');

  if v_rec.proveedor_id is not null then
    select exists (
      select 1 from public.empresas e
      where e.id = v_rec.proveedor_id
        and length(v_rif_cc) >= 4
        and regexp_replace(upper(coalesce(e.rif, '')), '[\s.-]', '', 'g') = v_rif_cc
    ) into v_proveedor_ok;
  else
    v_proveedor_ok := lower(trim(coalesce(v_cc.supplier_name, ''))) = lower(trim(coalesce(v_rec.proveedor_nombre, '')))
                      and trim(coalesce(v_rec.proveedor_nombre, '')) <> '';
  end if;

  if not coalesce(v_proveedor_ok, false) then
    return jsonb_build_object('success', false,
      'error', 'El proveedor de la compra de Procura no coincide con el de la recepción.');
  end if;

  update public.ci_recepciones_campo r
  set contabilidad_compra_provisional_id = coalesce(r.contabilidad_compra_provisional_id, r.contabilidad_compra_id),
      contabilidad_compra_id = v_cc.id
  where r.id = v_rec.id;

  return jsonb_build_object(
    'success', true,
    'recepcion_campo_id', v_rec.id,
    'contabilidad_compra_id', v_cc.id
  );
end;
$$;

revoke execute on function public.ci_enlazar_frm_con_compra_procura(uuid, uuid) from public, anon;
grant execute on function public.ci_enlazar_frm_con_compra_procura(uuid, uuid) to authenticated, service_role;

