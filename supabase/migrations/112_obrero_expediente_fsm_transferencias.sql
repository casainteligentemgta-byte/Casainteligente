-- Expediente obrero: máquina de estados estricta + bloqueo en BD de anticipos/liquidaciones
-- sin escaneo digital con cotejo explícito de firma y huella del trabajador en la tarea vinculada.
-- Tablas: obreros_expediente_tarea, obreros_transferencia_dinero (+ triggers).

-- ─── 1) Tarea de expediente (una fila = un documento / acto controlable) ─────
create table if not exists public.obreros_expediente_tarea (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.ci_empleados (id) on delete restrict,
  project_id uuid references public.ci_proyectos (id) on delete set null,
  clase_documento text not null
    check (clase_documento in ('anticipo', 'liquidacion', 'otro')),
  titulo text not null,
  referencia_externa text,
  notas text,
  estado text not null default 'creada'
    check (
      estado in (
        'creada',
        'pendiente_escaneo',
        'escaneo_cargado',
        'digitalizado_validado',
        'cerrada',
        'rechazada'
      )
    ),
  -- Escaneo (mismo registro: el estado avanza solo si los datos lo permiten)
  escaneo_storage_bucket text not null default 'worker-docs',
  escaneo_storage_path text,
  escaneo_subido_at timestamptz,
  escaneo_firma_trabajador_visible boolean not null default false,
  escaneo_huella_trabajador_visible boolean not null default false,
  escaneo_cotejado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obreros_expediente_escaneo_cargado_chk
    check (estado <> 'escaneo_cargado' or escaneo_storage_path is not null),
  constraint obreros_expediente_digitalizado_chk
    check (
      estado not in ('digitalizado_validado', 'cerrada')
      or (
        escaneo_storage_path is not null
        and escaneo_subido_at is not null
        and escaneo_firma_trabajador_visible is true
        and escaneo_huella_trabajador_visible is true
      )
    )
);

create index if not exists idx_obreros_expediente_worker
  on public.obreros_expediente_tarea (worker_id);

create index if not exists idx_obreros_expediente_project
  on public.obreros_expediente_tarea (project_id)
  where project_id is not null;

create index if not exists idx_obreros_expediente_estado
  on public.obreros_expediente_tarea (estado);

comment on table public.obreros_expediente_tarea is
  'Tarea de expediente obrero con FSM estricta. Anticipo/liquidación exige escaneo con firma y huella antes de digitalizado_validado/cerrada.';

-- ─── 2) Transferencias de dinero (anticipo / liquidación), amarradas a tarea ─
create table if not exists public.obreros_transferencia_dinero (
  id uuid primary key default gen_random_uuid(),
  expediente_tarea_id uuid not null references public.obreros_expediente_tarea (id) on delete restrict,
  tipo text not null check (tipo in ('anticipo', 'liquidacion')),
  monto numeric(14, 2) not null check (monto > 0),
  moneda text not null default 'VES' check (char_length(trim(moneda)) >= 3),
  descripcion text,
  estado_autorizacion text not null default 'borrador'
    check (estado_autorizacion in ('borrador', 'autorizada', 'rechazada', 'pagada')),
  autorizada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.obreros_transferencia_dinero is
  'Anticipos y liquidaciones. La BD impide autorizar/pagar si la tarea de expediente no está digitalizada con firma y huella.';

create index if not exists idx_obreros_transferencia_tarea
  on public.obreros_transferencia_dinero (expediente_tarea_id);

create index if not exists idx_obreros_transferencia_estado
  on public.obreros_transferencia_dinero (estado_autorizacion);

-- ─── 3) Timestamps ─────────────────────────────────────────────────────────
create or replace function public.touch_obreros_expediente_tarea_updated()
returns trigger as $$
begin
  new.updated_at := now();
  if new.escaneo_storage_path is not null and new.escaneo_subido_at is null then
    new.escaneo_subido_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obreros_expediente_tarea_updated on public.obreros_expediente_tarea;
create trigger tr_obreros_expediente_tarea_updated
  before insert or update on public.obreros_expediente_tarea
  for each row execute function public.touch_obreros_expediente_tarea_updated();

create or replace function public.touch_obreros_transferencia_dinero_updated()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obreros_transferencia_dinero_updated on public.obreros_transferencia_dinero;
create trigger tr_obreros_transferencia_dinero_updated
  before update on public.obreros_transferencia_dinero
  for each row execute function public.touch_obreros_transferencia_dinero_updated();

-- ─── 4) FSM: solo transiciones permitidas + reglas de retroceso ─────────────
create or replace function public.obreros_expediente_tarea_validar_transicion(
  p_old text,
  p_new text
) returns boolean as $$
begin
  if p_old = p_new then
    return true;
  end if;
  if p_new = 'rechazada' and p_old in ('creada', 'pendiente_escaneo', 'escaneo_cargado') then
    return true;
  end if;
  if p_old = 'creada' and p_new = 'pendiente_escaneo' then
    return true;
  end if;
  if p_old = 'pendiente_escaneo' and p_new = 'escaneo_cargado' then
    return true;
  end if;
  if p_old = 'escaneo_cargado' and p_new = 'digitalizado_validado' then
    return true;
  end if;
  if p_old = 'digitalizado_validado' and p_new = 'cerrada' then
    return true;
  end if;
  -- Corrección: volver a escaneo solo si aún no hay transferencias autorizadas/pagadas
  if p_old = 'digitalizado_validado' and p_new = 'escaneo_cargado' then
    return true;
  end if;
  if p_old = 'escaneo_cargado' and p_new = 'pendiente_escaneo' then
    return true;
  end if;
  if p_old = 'pendiente_escaneo' and p_new = 'creada' then
    return true;
  end if;
  return false;
end;
$$ language plpgsql immutable;

create or replace function public.tr_obreros_expediente_tarea_fsm()
returns trigger as $$
declare
  v_auth boolean;
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'creada' then
      raise exception 'obreros_expediente_tarea: la fila nueva debe iniciar en estado creada (recibido %)', new.estado;
    end if;
    return new;
  end if;

  if old.estado is distinct from new.estado then
    if not public.obreros_expediente_tarea_validar_transicion(old.estado, new.estado) then
      raise exception 'obreros_expediente_tarea: transición de estado no permitida: % → %', old.estado, new.estado;
    end if;
    if old.estado = 'digitalizado_validado'
       and new.estado in ('escaneo_cargado', 'pendiente_escaneo', 'creada') then
      select exists (
        select 1
        from public.obreros_transferencia_dinero t
        where t.expediente_tarea_id = old.id
          and t.estado_autorizacion in ('autorizada', 'pagada')
      )
      into v_auth;
      if v_auth then
        raise exception 'obreros_expediente_tarea: no se puede retroceder el estado con transferencias autorizadas o pagadas';
      end if;
    end if;
    if old.estado = 'cerrada' and new.estado is distinct from 'cerrada' then
      raise exception 'obreros_expediente_tarea: estado cerrada es terminal';
    end if;
    if old.estado = 'rechazada' and new.estado is distinct from 'rechazada' then
      raise exception 'obreros_expediente_tarea: estado rechazada es terminal';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obreros_expediente_tarea_fsm on public.obreros_expediente_tarea;
create trigger tr_obreros_expediente_tarea_fsm
  before insert or update on public.obreros_expediente_tarea
  for each row execute function public.tr_obreros_expediente_tarea_fsm();

-- ─── 5) Coherencia tipo transferencia ↔ clase tarea ───────────────────────
create or replace function public.tr_obreros_transferencia_tipo_clase()
returns trigger as $$
declare
  v_clase text;
begin
  select t.clase_documento
  into v_clase
  from public.obreros_expediente_tarea t
  where t.id = new.expediente_tarea_id;

  if v_clase is null then
    raise exception 'obreros_transferencia_dinero: tarea de expediente inexistente';
  end if;

  if new.tipo = 'anticipo' and v_clase <> 'anticipo' then
    raise exception 'obreros_transferencia_dinero: anticipo exige tarea clase_documento = anticipo (clase=%)', v_clase;
  end if;
  if new.tipo = 'liquidacion' and v_clase <> 'liquidacion' then
    raise exception 'obreros_transferencia_dinero: liquidación exige tarea clase_documento = liquidacion (clase=%)', v_clase;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obreros_transferencia_tipo_clase on public.obreros_transferencia_dinero;
create trigger tr_obreros_transferencia_tipo_clase
  before insert or update of expediente_tarea_id, tipo on public.obreros_transferencia_dinero
  for each row execute function public.tr_obreros_transferencia_tipo_clase();

-- ─── 6) Bloqueo lógico: autorizar / pagar solo con expediente válido ────────
create or replace function public.obreros_transferencia_dinero_expediente_listo(p_tarea_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.obreros_expediente_tarea t
    where t.id = p_tarea_id
      and t.estado in ('digitalizado_validado', 'cerrada')
      and t.escaneo_storage_path is not null
      and t.escaneo_firma_trabajador_visible is true
      and t.escaneo_huella_trabajador_visible is true
  );
$$ language sql stable;

create or replace function public.tr_obreros_transferencia_dinero_bloqueo_autorizacion()
returns trigger as $$
begin
  if new.estado_autorizacion in ('autorizada', 'pagada') then
    if not public.obreros_transferencia_dinero_expediente_listo(new.expediente_tarea_id) then
      raise exception
        'obreros_transferencia_dinero: no autorizable. El documento físico debe estar digitalizado en la tarea con cotejo de firma y huella del trabajador (estado digitalizado_validado o cerrada).';
    end if;
    if new.estado_autorizacion = 'autorizada'
       and (tg_op = 'INSERT' or coalesce(old.estado_autorizacion, '') <> 'autorizada') then
      new.autorizada_at := now();
    end if;
  end if;
  if tg_op = 'UPDATE'
     and coalesce(old.estado_autorizacion, '') in ('autorizada', 'pagada')
     and new.estado_autorizacion not in ('autorizada', 'pagada', 'rechazada') then
    raise exception 'obreros_transferencia_dinero: no se puede rebajar el estado desde autorizada/pagada salvo a rechazada';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obreros_transferencia_dinero_bloqueo on public.obreros_transferencia_dinero;
create trigger tr_obreros_transferencia_dinero_bloqueo
  before insert or update on public.obreros_transferencia_dinero
  for each row execute function public.tr_obreros_transferencia_dinero_bloqueo_autorizacion();

-- ─── 7) RLS (mismo estilo que mano de obra / worker-docs) ───────────────────
alter table public.obreros_expediente_tarea enable row level security;
alter table public.obreros_transferencia_dinero enable row level security;

drop policy if exists "obreros_expediente_tarea_select_anon" on public.obreros_expediente_tarea;
drop policy if exists "obreros_expediente_tarea_insert_anon" on public.obreros_expediente_tarea;
drop policy if exists "obreros_expediente_tarea_update_anon" on public.obreros_expediente_tarea;
drop policy if exists "obreros_expediente_tarea_delete_anon" on public.obreros_expediente_tarea;
drop policy if exists "obreros_expediente_tarea_select_auth" on public.obreros_expediente_tarea;
drop policy if exists "obreros_expediente_tarea_insert_auth" on public.obreros_expediente_tarea;
drop policy if exists "obreros_expediente_tarea_update_auth" on public.obreros_expediente_tarea;
drop policy if exists "obreros_expediente_tarea_delete_auth" on public.obreros_expediente_tarea;

create policy "obreros_expediente_tarea_select_anon" on public.obreros_expediente_tarea for select to anon using (true);
create policy "obreros_expediente_tarea_insert_anon" on public.obreros_expediente_tarea for insert to anon with check (true);
create policy "obreros_expediente_tarea_update_anon" on public.obreros_expediente_tarea for update to anon using (true) with check (true);
create policy "obreros_expediente_tarea_delete_anon" on public.obreros_expediente_tarea for delete to anon using (true);
create policy "obreros_expediente_tarea_select_auth" on public.obreros_expediente_tarea for select to authenticated using (true);
create policy "obreros_expediente_tarea_insert_auth" on public.obreros_expediente_tarea for insert to authenticated with check (true);
create policy "obreros_expediente_tarea_update_auth" on public.obreros_expediente_tarea for update to authenticated using (true) with check (true);
create policy "obreros_expediente_tarea_delete_auth" on public.obreros_expediente_tarea for delete to authenticated using (true);

drop policy if exists "obreros_transferencia_select_anon" on public.obreros_transferencia_dinero;
drop policy if exists "obreros_transferencia_insert_anon" on public.obreros_transferencia_dinero;
drop policy if exists "obreros_transferencia_update_anon" on public.obreros_transferencia_dinero;
drop policy if exists "obreros_transferencia_delete_anon" on public.obreros_transferencia_dinero;
drop policy if exists "obreros_transferencia_select_auth" on public.obreros_transferencia_dinero;
drop policy if exists "obreros_transferencia_insert_auth" on public.obreros_transferencia_dinero;
drop policy if exists "obreros_transferencia_update_auth" on public.obreros_transferencia_dinero;
drop policy if exists "obreros_transferencia_delete_auth" on public.obreros_transferencia_dinero;

create policy "obreros_transferencia_select_anon" on public.obreros_transferencia_dinero for select to anon using (true);
create policy "obreros_transferencia_insert_anon" on public.obreros_transferencia_dinero for insert to anon with check (true);
create policy "obreros_transferencia_update_anon" on public.obreros_transferencia_dinero for update to anon using (true) with check (true);
create policy "obreros_transferencia_delete_anon" on public.obreros_transferencia_dinero for delete to anon using (true);
create policy "obreros_transferencia_select_auth" on public.obreros_transferencia_dinero for select to authenticated using (true);
create policy "obreros_transferencia_insert_auth" on public.obreros_transferencia_dinero for insert to authenticated with check (true);
create policy "obreros_transferencia_update_auth" on public.obreros_transferencia_dinero for update to authenticated using (true) with check (true);
create policy "obreros_transferencia_delete_auth" on public.obreros_transferencia_dinero for delete to authenticated using (true);

grant select, insert, update, delete on public.obreros_expediente_tarea to anon, authenticated, service_role;
grant select, insert, update, delete on public.obreros_transferencia_dinero to anon, authenticated, service_role;

notify pgrst, 'reload schema';
