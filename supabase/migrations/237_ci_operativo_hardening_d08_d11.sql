-- D-08: cola/reintento sync contabilidad tras ingreso campo
-- D-09: máquina de transiciones en procesar_procuras_lote
-- D-11: asegurar inv_stock_apply_delta única (ledger obligatorio)

-- ── D-08 ─────────────────────────────────────────────────────────────────────
alter table public.ci_recepciones_campo
  add column if not exists contabilidad_sync_pendiente boolean not null default false,
  add column if not exists contabilidad_sync_error text,
  add column if not exists contabilidad_sync_intentos integer not null default 0,
  add column if not exists contabilidad_sync_at timestamptz;

create index if not exists idx_ci_recepciones_campo_conta_pendiente
  on public.ci_recepciones_campo (contabilidad_sync_pendiente, created_at desc)
  where contabilidad_sync_pendiente = true;

comment on column public.ci_recepciones_campo.contabilidad_sync_pendiente is
  'D-08: stock ingresado pero contabilidad pendiente de sincronizar.';
comment on column public.ci_recepciones_campo.contabilidad_sync_error is
  'D-08: último error al sincronizar contabilidad desde recepción campo.';
comment on column public.ci_recepciones_campo.contabilidad_sync_intentos is
  'D-08: intentos de sync contable (incluye reintentos manuales/automáticos).';
comment on column public.ci_recepciones_campo.contabilidad_sync_at is
  'D-08: timestamp del último intento de sync contable.';

-- ── D-09: validación de transiciones ─────────────────────────────────────────
create or replace function public.ci_procura_transicion_estado_valida(
  p_estado_anterior text,
  p_estado_nuevo text
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_ant text := lower(btrim(coalesce(p_estado_anterior, '')));
  v_nue text := lower(btrim(coalesce(p_estado_nuevo, '')));
begin
  if v_ant = v_nue then
    return true;
  end if;

  case v_ant
    when 'borrador' then
      return v_nue in ('solicitada', 'cancelada');
    when 'solicitada' then
      return v_nue in (
        'aprobada',
        'aprobada_directa',
        'en_compra',
        'rechazada',
        'cancelada'
      );
    when 'aprobada' then
      return v_nue in ('en_compra', 'rechazada', 'cancelada');
    when 'aprobada_directa' then
      return v_nue in ('en_compra', 'cancelada');
    when 'en_compra' then
      return v_nue in ('recibida_parcial', 'recibida', 'cancelada');
    when 'recibida_parcial' then
      return v_nue in ('recibida', 'en_compra', 'cancelada');
    when 'recibida' then
      return v_nue in ('cancelada');
    when 'rechazada', 'cancelada' then
      return false;
    else
      return false;
  end case;
end;
$$;

comment on function public.ci_procura_transicion_estado_valida(text, text) is
  'D-09: FSM manual de procuras (procesar_procuras_lote). ci_procura_actualizar_recepcion usa su propio flujo.';

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
  'D-09: actualiza estado en lote con FSM; notifica Telegram. Solo service_role (migr. 234).';

-- ── D-11: una sola firma inv_stock_apply_delta (con ledger) ─────────────────
drop function if exists public.inv_stock_apply_delta(
  uuid,
  uuid,
  numeric,
  numeric,
  numeric
);

notify pgrst, 'reload schema';
