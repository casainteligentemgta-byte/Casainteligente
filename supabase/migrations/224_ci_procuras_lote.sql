-- Procuras / solicitudes de abastecimiento + procesamiento en lote con notificación Telegram.

create sequence if not exists public.ci_procura_ticket_seq;

create table if not exists public.ci_procuras (
  id uuid primary key default gen_random_uuid(),
  ticket text not null,
  estado text not null default 'solicitada',
  material_id uuid references public.global_inventory (id) on delete set null,
  material_txt text not null,
  cantidad numeric(14, 4) not null default 1 check (cantidad > 0),
  unidad text not null default 'UND',
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  entidad_id uuid references public.ci_entidades (id) on delete set null,
  ubicacion_destino_id uuid references public.inv_ubicaciones (id) on delete set null,
  solicitante_empleado_id uuid references public.ci_empleados (id) on delete set null,
  solicitante_telegram_chat_id bigint,
  asignado_empleado_id uuid references public.ci_empleados (id) on delete set null,
  asignado_telegram_chat_id bigint,
  motivo_ultimo text,
  observaciones text,
  purchase_invoice_id uuid references public.purchase_invoices (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ci_procuras
  drop constraint if exists ci_procuras_estado_check;

alter table public.ci_procuras
  add constraint ci_procuras_estado_check
  check (
    estado in (
      'borrador',
      'solicitada',
      'aprobada',
      'en_compra',
      'recibida_parcial',
      'recibida',
      'cancelada',
      'rechazada'
    )
  );

create unique index if not exists idx_ci_procuras_ticket
  on public.ci_procuras (ticket);

create index if not exists idx_ci_procuras_estado
  on public.ci_procuras (estado, updated_at desc);

create index if not exists idx_ci_procuras_proyecto
  on public.ci_procuras (proyecto_id, estado)
  where proyecto_id is not null;

create index if not exists idx_ci_procuras_entidad
  on public.ci_procuras (entidad_id, estado)
  where entidad_id is not null;

comment on table public.ci_procuras is
  'Solicitudes de abastecimiento (procuras) por obra/entidad; fuera de contabilidad_compras hasta recepción.';

create table if not exists public.ci_procura_estados_historial (
  id uuid primary key default gen_random_uuid(),
  procura_id uuid not null references public.ci_procuras (id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  motivo text,
  usuario text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_procura_estados_historial_procura
  on public.ci_procura_estados_historial (procura_id, created_at desc);

comment on table public.ci_procura_estados_historial is
  'Auditoría de cambios de estado en procuras.';

-- Ticket legible PR-2026-00042
create or replace function public.ci_generar_ticket_procura()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_seq bigint;
begin
  v_seq := nextval('public.ci_procura_ticket_seq');
  return 'PR-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

create or replace function public.ci_procuras_set_ticket()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ticket is null or btrim(new.ticket) = '' then
    new.ticket := public.ci_generar_ticket_procura();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ci_procuras_set_ticket on public.ci_procuras;
create trigger trg_ci_procuras_set_ticket
  before insert or update on public.ci_procuras
  for each row execute function public.ci_procuras_set_ticket();

create or replace function public.ci_procura_resolver_telegram_chat_id(p_procura public.ci_procuras)
returns bigint
language plpgsql
stable
set search_path = public
as $$
declare
  v_chat bigint;
begin
  if p_procura.asignado_telegram_chat_id is not null then
    return p_procura.asignado_telegram_chat_id;
  end if;

  if p_procura.asignado_empleado_id is not null then
    select w.chat_id into v_chat
    from public.ci_telegram_whitelist w
    where w.empleado_id = p_procura.asignado_empleado_id
      and w.activo = true
    order by w.updated_at desc
    limit 1;
    if v_chat is not null then
      return v_chat;
    end if;
  end if;

  if p_procura.solicitante_telegram_chat_id is not null then
    return p_procura.solicitante_telegram_chat_id;
  end if;

  if p_procura.solicitante_empleado_id is not null then
    select w.chat_id into v_chat
    from public.ci_telegram_whitelist w
    where w.empleado_id = p_procura.solicitante_empleado_id
      and w.activo = true
    order by w.updated_at desc
    limit 1;
    if v_chat is not null then
      return v_chat;
    end if;
  end if;

  return null;
end;
$$;

comment on function public.ci_procura_resolver_telegram_chat_id(public.ci_procuras) is
  'Resuelve chat_id Telegram para notificar cambios de estado (asignado > solicitante > whitelist).';

-- Procesa un lote de procuras y devuelve filas para notificar por Telegram.
create or replace function public.procesar_procuras_lote(
  p_ids uuid[],
  p_nuevo_estado text,
  p_motivo text default null
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
  'Actualiza estado de procuras en lote y devuelve datos para notificar técnicos por Telegram.';

grant execute on function public.procesar_procuras_lote(uuid[], text, text)
  to anon, authenticated, service_role;

alter table public.ci_procuras enable row level security;
alter table public.ci_procura_estados_historial enable row level security;

drop policy if exists "ci_procuras_select_anon" on public.ci_procuras;
drop policy if exists "ci_procuras_insert_anon" on public.ci_procuras;
drop policy if exists "ci_procuras_update_anon" on public.ci_procuras;
drop policy if exists "ci_procuras_delete_anon" on public.ci_procuras;
drop policy if exists "ci_procuras_select_auth" on public.ci_procuras;
drop policy if exists "ci_procuras_insert_auth" on public.ci_procuras;
drop policy if exists "ci_procuras_update_auth" on public.ci_procuras;
drop policy if exists "ci_procuras_delete_auth" on public.ci_procuras;

create policy "ci_procuras_select_anon" on public.ci_procuras for select to anon using (true);
create policy "ci_procuras_insert_anon" on public.ci_procuras for insert to anon with check (true);
create policy "ci_procuras_update_anon" on public.ci_procuras for update to anon using (true) with check (true);
create policy "ci_procuras_delete_anon" on public.ci_procuras for delete to anon using (true);

create policy "ci_procuras_select_auth" on public.ci_procuras for select to authenticated using (true);
create policy "ci_procuras_insert_auth" on public.ci_procuras for insert to authenticated with check (true);
create policy "ci_procuras_update_auth" on public.ci_procuras for update to authenticated using (true) with check (true);
create policy "ci_procuras_delete_auth" on public.ci_procuras for delete to authenticated using (true);

drop policy if exists "ci_procura_hist_select_anon" on public.ci_procura_estados_historial;
drop policy if exists "ci_procura_hist_insert_anon" on public.ci_procura_estados_historial;
drop policy if exists "ci_procura_hist_select_auth" on public.ci_procura_estados_historial;
drop policy if exists "ci_procura_hist_insert_auth" on public.ci_procura_estados_historial;

create policy "ci_procura_hist_select_anon"
  on public.ci_procura_estados_historial for select to anon using (true);
create policy "ci_procura_hist_insert_anon"
  on public.ci_procura_estados_historial for insert to anon with check (true);
create policy "ci_procura_hist_select_auth"
  on public.ci_procura_estados_historial for select to authenticated using (true);
create policy "ci_procura_hist_insert_auth"
  on public.ci_procura_estados_historial for insert to authenticated with check (true);

notify pgrst, 'reload schema';
