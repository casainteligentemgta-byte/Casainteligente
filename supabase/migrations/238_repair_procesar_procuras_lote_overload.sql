-- PGRST203: PostgREST no puede elegir entre overloads de procesar_procuras_lote
-- (p_motivo con DEFAULT crea ambigüedad uuid[]+text vs uuid[]+text+text).
-- También puede coexistir firma legada (integer[], estado_procura, text) en BD antigua.
-- Reparación: eliminar todas las firmas y dejar una sola uuid[]+text+text, sin DEFAULT.

drop function if exists public.procesar_procuras_lote(integer[], public.estado_procura, text);
drop function if exists public.procesar_procuras_lote(uuid[], text);
drop function if exists public.procesar_procuras_lote(uuid[], text, text);

create or replace function public.procesar_procuras_lote(
  p_ids uuid[],
  p_nuevo_estado text,
  p_motivo text
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
      motivo
    ) values (
      v_row.id,
      v_row.estado,
      v_estado,
      nullif(btrim(coalesce(p_motivo, '')), '')
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

comment on function public.procesar_procuras_lote(uuid[], text, text) is
  'Actualiza estado en lote con FSM (D-09). Firma única sin DEFAULT — evita PGRST203. Solo service_role.';

revoke execute on function public.procesar_procuras_lote(uuid[], text, text) from public;
revoke execute on function public.procesar_procuras_lote(uuid[], text, text) from anon;
revoke execute on function public.procesar_procuras_lote(uuid[], text, text) from authenticated;
grant execute on function public.procesar_procuras_lote(uuid[], text, text) to service_role;

notify pgrst, 'reload schema';
