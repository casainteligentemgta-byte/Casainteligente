-- procesar_procuras_lote: metadatos jsonb + usuario en historial (auditoría supervisor formal).

drop function if exists public.procesar_procuras_lote(uuid[], text, text);

create or replace function public.procesar_procuras_lote(
  p_ids uuid[],
  p_nuevo_estado text,
  p_motivo text,
  p_metadatos jsonb default '{}'::jsonb,
  p_usuario text default null
)
returns table (
  procura_id uuid,
  ticket text,
  material_txt text,
  nuevo_est text,
  telegram_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_row public.ci_procuras;
  v_estado text;
  v_chat bigint;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'Debe indicar al menos un id de procura.';
  end if;

  v_estado := lower(btrim(coalesce(p_nuevo_estado, '')));
  if v_estado = '' then
    raise exception 'Debe indicar p_nuevo_estado.';
  end if;

  if v_estado not in (
    'borrador',
    'solicitada',
    'pendiente_pm',
    'aprobada',
    'aprobada_directa',
    'en_compra',
    'recibida_parcial',
    'recibida',
    'cancelada',
    'rechazada'
  ) then
    raise exception 'Estado no válido: %', v_estado;
  end if;

  foreach v_id in array p_ids loop
    select * into v_row
    from public.ci_procuras p
    where p.id = v_id
    for update;

    if not found then
      continue;
    end if;

    if v_estado = 'en_compra' and v_row.purchase_invoice_id is null then
      raise exception
        'No se puede marcar «Comprada» en % sin factura vinculada (purchase_invoice_id). Registre la factura con /facturas.',
        coalesce(v_row.ticket, v_row.id::text);
    end if;

    if v_row.estado = v_estado then
      v_chat := public.ci_procura_resolver_telegram_chat_id(v_row);
      procura_id := v_row.id;
      ticket := v_row.ticket;
      material_txt := v_row.material_txt;
      nuevo_est := v_estado;
      telegram_id := case when v_chat is not null then v_chat::text else null end;
      return next;
      continue;
    end if;

    if not public.ci_procura_transicion_estado_valida(v_row.estado, v_estado) then
      raise exception
        'Transición no permitida para procura %: % → %',
        coalesce(v_row.ticket, v_row.id::text),
        v_row.estado,
        v_estado;
    end if;

    insert into public.ci_procura_estados_historial (
      procura_id,
      estado_anterior,
      estado_nuevo,
      motivo,
      usuario,
      metadatos
    ) values (
      v_row.id,
      v_row.estado,
      v_estado,
      nullif(btrim(coalesce(p_motivo, '')), ''),
      nullif(btrim(coalesce(p_usuario, '')), ''),
      coalesce(p_metadatos, '{}'::jsonb)
    );

    update public.ci_procuras p
    set
      estado = v_estado,
      motivo_ultimo = nullif(btrim(coalesce(p_motivo, '')), ''),
      updated_at = now()
    where p.id = v_row.id
    returning * into v_row;

    v_chat := public.ci_procura_resolver_telegram_chat_id(v_row);

    procura_id := v_row.id;
    ticket := v_row.ticket;
    material_txt := v_row.material_txt;
    nuevo_est := v_estado;
    telegram_id := case when v_chat is not null then v_chat::text else null end;
    return next;
  end loop;
end;
$$;

comment on function public.procesar_procuras_lote(uuid[], text, text, jsonb, text) is
  'FSM procuras con metadatos de auditoría en historial. en_compra solo con purchase_invoice_id.';

revoke execute on function public.procesar_procuras_lote(uuid[], text, text, jsonb, text) from public;
revoke execute on function public.procesar_procuras_lote(uuid[], text, text, jsonb, text) from anon;
revoke execute on function public.procesar_procuras_lote(uuid[], text, text, jsonb, text) from authenticated;
grant execute on function public.procesar_procuras_lote(uuid[], text, text, jsonb, text) to service_role;

notify pgrst, 'reload schema';
