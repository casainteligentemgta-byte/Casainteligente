-- Expediente de Obra Digital (LOTTT Venezuela): contrato con FSM estricta,
-- documentos escaneados (firma + huella donde aplica), herramientas, anticipos y rendimiento diario.
-- Stack: PostgreSQL (Supabase). Sin Prisma en runtime; Drizzle opcional en app.

-- ─── 1) Contrato obrero (agregado del expediente digital) ────────────────────
create table if not exists public.obra_digital_labor_contracts (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  worker_ci text not null,
  contract_status text not null default 'PENDIENTE_DOCUMENTOS'
    check (
      contract_status in (
        'PENDIENTE_DOCUMENTOS',
        'ACTIVO',
        'LIQUIDACION',
        'CERRADO_HISTORICO'
      )
    ),
  oficio text not null,
  salary_per_day numeric(14, 2) not null check (salary_per_day > 0),
  lulo_partida_meta text not null,
  project_id uuid references public.ci_proyectos (id) on delete set null,
  empleado_id uuid references public.ci_empleados (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obra_digital_worker_ci_unique unique (worker_ci)
);

create index if not exists idx_obra_digital_contracts_status
  on public.obra_digital_labor_contracts (contract_status);

create index if not exists idx_obra_digital_contracts_project
  on public.obra_digital_labor_contracts (project_id)
  where project_id is not null;

comment on table public.obra_digital_labor_contracts is
  'Expediente digital obrero: FSM PENDIENTE_DOCUMENTOS→ACTIVO→LIQUIDACION→CERRADO_HISTORICO.';

-- ─── 2) Documentos (PDF/JPG en Storage; cotejo firma/huella para actos críticos) ─
create table if not exists public.obra_digital_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.obra_digital_labor_contracts (id) on delete cascade,
  doc_type text not null
    check (
      doc_type in (
        'CEDULA',
        'INVENTARIO_ENTREGA',
        'ANTICIPO_MENSUAL',
        'LIBRO_OBRA_SEMANAL',
        'FINIQUITO'
      )
    ),
  storage_bucket text not null default 'worker-docs',
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  escaneo_firma_visible boolean not null default false,
  escaneo_huella_visible boolean not null default false,
  reference_month smallint check (reference_month is null or (reference_month >= 1 and reference_month <= 12)),
  reference_year smallint check (reference_year is null or reference_year >= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obra_digital_doc_anticipo_ref_chk
    check (
      doc_type <> 'ANTICIPO_MENSUAL'
      or (reference_month is not null and reference_year is not null)
    )
);

create index if not exists idx_obra_digital_documents_contract
  on public.obra_digital_documents (contract_id);

create index if not exists idx_obra_digital_documents_type
  on public.obra_digital_documents (contract_id, doc_type);

comment on table public.obra_digital_documents is
  'Soportes escaneados. ANTICIPO_MENSUAL exige reference_month/year. Activación ACTIVO vía INVENTARIO_ENTREGA con firma+huella.';

-- ─── 3) Asignación de herramientas ──────────────────────────────────────────
create table if not exists public.obra_digital_tool_assignments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.obra_digital_labor_contracts (id) on delete cascade,
  tool_name text not null,
  serial_number text not null,
  status text not null default 'BAJO_CUSTODIA'
    check (status in ('BAJO_CUSTODIA', 'DEVUELTO_OK', 'PERDIDO_NEGLIGENCIA')),
  replacement_value numeric(14, 2) not null default 0 check (replacement_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_obra_digital_tools_contract
  on public.obra_digital_tool_assignments (contract_id);

-- ─── 4) Anticipo mensual (75% máx. sobre acumulado; pago bloqueado sin escaneo) ─
create table if not exists public.obra_digital_monthly_advances (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.obra_digital_labor_contracts (id) on delete cascade,
  month smallint not null check (month >= 1 and month <= 12),
  year smallint not null check (year >= 2000),
  calculated_accrued numeric(14, 2) not null check (calculated_accrued >= 0),
  max_advance_allowed numeric(14, 2) not null check (max_advance_allowed >= 0),
  status text not null default 'PAGO_BLOQUEADO'
    check (status in ('PAGO_BLOQUEADO', 'LISTO_PARA_PAGO', 'PAGADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obra_digital_monthly_advances_unique unique (contract_id, month, year)
);

create index if not exists idx_obra_digital_advances_contract
  on public.obra_digital_monthly_advances (contract_id);

-- ─── 5) Rendimiento diario (solo contrato ACTIVO) ───────────────────────────
create table if not exists public.obra_digital_daily_progress (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.obra_digital_labor_contracts (id) on delete cascade,
  work_date date not null,
  physical_advance numeric(14, 3) not null check (physical_advance >= 0),
  created_at timestamptz not null default now(),
  constraint obra_digital_daily_progress_unique unique (contract_id, work_date)
);

create index if not exists idx_obra_digital_daily_contract
  on public.obra_digital_daily_progress (contract_id);

-- ─── 6) Timestamps ───────────────────────────────────────────────────────────
create or replace function public.touch_obra_digital_contracts()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obra_digital_contracts_touch on public.obra_digital_labor_contracts;
create trigger tr_obra_digital_contracts_touch
  before update on public.obra_digital_labor_contracts
  for each row execute function public.touch_obra_digital_contracts();

create or replace function public.touch_obra_digital_documents()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obra_digital_documents_touch on public.obra_digital_documents;
create trigger tr_obra_digital_documents_touch
  before update on public.obra_digital_documents
  for each row execute function public.touch_obra_digital_documents();

create or replace function public.touch_obra_digital_tools()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obra_digital_tools_touch on public.obra_digital_tool_assignments;
create trigger tr_obra_digital_tools_touch
  before update on public.obra_digital_tool_assignments
  for each row execute function public.touch_obra_digital_tools();

create or replace function public.touch_obra_digital_advances()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obra_digital_advances_touch on public.obra_digital_monthly_advances;
create trigger tr_obra_digital_advances_touch
  before update on public.obra_digital_monthly_advances
  for each row execute function public.touch_obra_digital_advances();

-- ─── 7) FSM contrato ─────────────────────────────────────────────────────────
create or replace function public.obra_digital_contract_fsm_allowed(p_old text, p_new text)
returns boolean as $$
begin
  if p_old = p_new then
    return true;
  end if;
  if p_old = 'PENDIENTE_DOCUMENTOS' and p_new = 'ACTIVO' then
    return true;
  end if;
  if p_old = 'ACTIVO' and p_new in ('LIQUIDACION', 'PENDIENTE_DOCUMENTOS') then
    return p_new = 'LIQUIDACION';
  end if;
  if p_old = 'LIQUIDACION' and p_new = 'CERRADO_HISTORICO' then
    return true;
  end if;
  return false;
end;
$$ language plpgsql immutable;

create or replace function public.obra_digital_contract_has_inventario_valid(p_contract_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.obra_digital_documents d
    where d.contract_id = p_contract_id
      and d.doc_type = 'INVENTARIO_ENTREGA'
      and d.escaneo_firma_visible is true
      and d.escaneo_huella_visible is true
  );
$$ language sql stable;

create or replace function public.obra_digital_contract_has_finiquito_valid(p_contract_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.obra_digital_documents d
    where d.contract_id = p_contract_id
      and d.doc_type = 'FINIQUITO'
      and d.escaneo_firma_visible is true
      and d.escaneo_huella_visible is true
  );
$$ language sql stable;

create or replace function public.tr_obra_digital_contracts_fsm()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.contract_status <> 'PENDIENTE_DOCUMENTOS' then
      raise exception 'obra_digital_labor_contracts: el alta debe ser en PENDIENTE_DOCUMENTOS (recibido %)', new.contract_status;
    end if;
    return new;
  end if;

  if old.contract_status is distinct from new.contract_status then
    if not public.obra_digital_contract_fsm_allowed(old.contract_status, new.contract_status) then
      raise exception 'obra_digital_labor_contracts: transición no permitida: % → %', old.contract_status, new.contract_status;
    end if;
    if new.contract_status = 'ACTIVO' then
      if not public.obra_digital_contract_has_inventario_valid(new.id) then
        raise exception 'obra_digital_labor_contracts: ACTIVO requiere documento INVENTARIO_ENTREGA escaneado con firma y huella del trabajador';
      end if;
    end if;
    if new.contract_status = 'CERRADO_HISTORICO' then
      if not public.obra_digital_contract_has_finiquito_valid(new.id) then
        raise exception 'obra_digital_labor_contracts: CERRADO_HISTORICO requiere FINIQUITO escaneado con firma y huella';
      end if;
    end if;
    if old.contract_status = 'CERRADO_HISTORICO' then
      raise exception 'obra_digital_labor_contracts: CERRADO_HISTORICO es terminal';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obra_digital_contracts_fsm on public.obra_digital_labor_contracts;
create trigger tr_obra_digital_contracts_fsm
  before insert or update on public.obra_digital_labor_contracts
  for each row execute function public.tr_obra_digital_contracts_fsm();

-- ─── 8) Tras cargar acta firmada + huella: pasar a ACTIVO automáticamente ─────
create or replace function public.tr_obra_digital_documents_after()
returns trigger as $$
begin
  if new.doc_type = 'INVENTARIO_ENTREGA'
     and new.escaneo_firma_visible is true
     and new.escaneo_huella_visible is true then
    update public.obra_digital_labor_contracts c
    set contract_status = 'ACTIVO'
    where c.id = new.contract_id
      and c.contract_status = 'PENDIENTE_DOCUMENTOS';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obra_digital_documents_after on public.obra_digital_documents;
create trigger tr_obra_digital_documents_after
  after insert or update of doc_type, escaneo_firma_visible, escaneo_huella_visible
  on public.obra_digital_documents
  for each row execute function public.tr_obra_digital_documents_after();

-- ─── 9) Rendimiento diario solo si contrato ACTIVO ──────────────────────────
create or replace function public.tr_obra_digital_daily_progress_guard()
returns trigger as $$
declare
  st text;
begin
  select c.contract_status into st
  from public.obra_digital_labor_contracts c
  where c.id = new.contract_id;
  if st is null then
    raise exception 'obra_digital_daily_progress: contrato inexistente';
  end if;
  if st <> 'ACTIVO' then
    raise exception 'obra_digital_daily_progress: solo se permite rendimiento con contrato en ACTIVO (estado=%)', st;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_obra_digital_daily_progress_guard on public.obra_digital_daily_progress;
create trigger tr_obra_digital_daily_progress_guard
  before insert or update on public.obra_digital_daily_progress
  for each row execute function public.tr_obra_digital_daily_progress_guard();

-- ─── 10) Anticipo: LISTO_PARA_PAGO / PAGADO exigen escaneo ANTICIPO_MENSUAL ──
create or replace function public.obra_digital_has_anticipo_doc(
  p_contract_id uuid,
  p_month smallint,
  p_year smallint
) returns boolean as $$
  select exists (
    select 1
    from public.obra_digital_documents d
    where d.contract_id = p_contract_id
      and d.doc_type = 'ANTICIPO_MENSUAL'
      and d.reference_month = p_month
      and d.reference_year = p_year
      and d.escaneo_firma_visible is true
      and d.escaneo_huella_visible is true
  );
$$ language sql stable;

create or replace function public.tr_obra_digital_monthly_advances_guard()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'PAGO_BLOQUEADO' then
      raise exception 'obra_digital_monthly_advances: el alta debe ser PAGO_BLOQUEADO';
    end if;
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status = 'PAGO_BLOQUEADO' and new.status = 'LISTO_PARA_PAGO' then
    if not public.obra_digital_has_anticipo_doc(new.contract_id, new.month, new.year) then
      raise exception 'obra_digital_monthly_advances: LISTO_PARA_PAGO requiere documento ANTICIPO_MENSUAL escaneado con firma y huella para el mismo mes/año';
    end if;
    return new;
  end if;

  if old.status = 'LISTO_PARA_PAGO' and new.status = 'PAGADO' then
    if not public.obra_digital_has_anticipo_doc(new.contract_id, new.month, new.year) then
      raise exception 'obra_digital_monthly_advances: PAGADO requiere soporte ANTICIPO_MENSUAL válido';
    end if;
    return new;
  end if;

  raise exception 'obra_digital_monthly_advances: transición no permitida: % → %', old.status, new.status;
end;
$$ language plpgsql;

drop trigger if exists tr_obra_digital_monthly_advances_guard on public.obra_digital_monthly_advances;
create trigger tr_obra_digital_monthly_advances_guard
  before insert or update on public.obra_digital_monthly_advances
  for each row execute function public.tr_obra_digital_monthly_advances_guard();

-- ─── 11) RLS (coherente con resto CI) ────────────────────────────────────────
alter table public.obra_digital_labor_contracts enable row level security;
alter table public.obra_digital_documents enable row level security;
alter table public.obra_digital_tool_assignments enable row level security;
alter table public.obra_digital_monthly_advances enable row level security;
alter table public.obra_digital_daily_progress enable row level security;

drop policy if exists "obra_digital_contracts_select_anon" on public.obra_digital_labor_contracts;
drop policy if exists "obra_digital_contracts_insert_anon" on public.obra_digital_labor_contracts;
drop policy if exists "obra_digital_contracts_update_anon" on public.obra_digital_labor_contracts;
drop policy if exists "obra_digital_contracts_delete_anon" on public.obra_digital_labor_contracts;
drop policy if exists "obra_digital_contracts_select_auth" on public.obra_digital_labor_contracts;
drop policy if exists "obra_digital_contracts_insert_auth" on public.obra_digital_labor_contracts;
drop policy if exists "obra_digital_contracts_update_auth" on public.obra_digital_labor_contracts;
drop policy if exists "obra_digital_contracts_delete_auth" on public.obra_digital_labor_contracts;

create policy "obra_digital_contracts_select_anon" on public.obra_digital_labor_contracts for select to anon using (true);
create policy "obra_digital_contracts_insert_anon" on public.obra_digital_labor_contracts for insert to anon with check (true);
create policy "obra_digital_contracts_update_anon" on public.obra_digital_labor_contracts for update to anon using (true) with check (true);
create policy "obra_digital_contracts_delete_anon" on public.obra_digital_labor_contracts for delete to anon using (true);
create policy "obra_digital_contracts_select_auth" on public.obra_digital_labor_contracts for select to authenticated using (true);
create policy "obra_digital_contracts_insert_auth" on public.obra_digital_labor_contracts for insert to authenticated with check (true);
create policy "obra_digital_contracts_update_auth" on public.obra_digital_labor_contracts for update to authenticated using (true) with check (true);
create policy "obra_digital_contracts_delete_auth" on public.obra_digital_labor_contracts for delete to authenticated using (true);

drop policy if exists "obra_digital_documents_select_anon" on public.obra_digital_documents;
drop policy if exists "obra_digital_documents_insert_anon" on public.obra_digital_documents;
drop policy if exists "obra_digital_documents_update_anon" on public.obra_digital_documents;
drop policy if exists "obra_digital_documents_delete_anon" on public.obra_digital_documents;
drop policy if exists "obra_digital_documents_select_auth" on public.obra_digital_documents;
drop policy if exists "obra_digital_documents_insert_auth" on public.obra_digital_documents;
drop policy if exists "obra_digital_documents_update_auth" on public.obra_digital_documents;
drop policy if exists "obra_digital_documents_delete_auth" on public.obra_digital_documents;

create policy "obra_digital_documents_select_anon" on public.obra_digital_documents for select to anon using (true);
create policy "obra_digital_documents_insert_anon" on public.obra_digital_documents for insert to anon with check (true);
create policy "obra_digital_documents_update_anon" on public.obra_digital_documents for update to anon using (true) with check (true);
create policy "obra_digital_documents_delete_anon" on public.obra_digital_documents for delete to anon using (true);
create policy "obra_digital_documents_select_auth" on public.obra_digital_documents for select to authenticated using (true);
create policy "obra_digital_documents_insert_auth" on public.obra_digital_documents for insert to authenticated with check (true);
create policy "obra_digital_documents_update_auth" on public.obra_digital_documents for update to authenticated using (true) with check (true);
create policy "obra_digital_documents_delete_auth" on public.obra_digital_documents for delete to authenticated using (true);

drop policy if exists "obra_digital_tools_select_anon" on public.obra_digital_tool_assignments;
drop policy if exists "obra_digital_tools_insert_anon" on public.obra_digital_tool_assignments;
drop policy if exists "obra_digital_tools_update_anon" on public.obra_digital_tool_assignments;
drop policy if exists "obra_digital_tools_delete_anon" on public.obra_digital_tool_assignments;
drop policy if exists "obra_digital_tools_select_auth" on public.obra_digital_tool_assignments;
drop policy if exists "obra_digital_tools_insert_auth" on public.obra_digital_tool_assignments;
drop policy if exists "obra_digital_tools_update_auth" on public.obra_digital_tool_assignments;
drop policy if exists "obra_digital_tools_delete_auth" on public.obra_digital_tool_assignments;

create policy "obra_digital_tools_select_anon" on public.obra_digital_tool_assignments for select to anon using (true);
create policy "obra_digital_tools_insert_anon" on public.obra_digital_tool_assignments for insert to anon with check (true);
create policy "obra_digital_tools_update_anon" on public.obra_digital_tool_assignments for update to anon using (true) with check (true);
create policy "obra_digital_tools_delete_anon" on public.obra_digital_tool_assignments for delete to anon using (true);
create policy "obra_digital_tools_select_auth" on public.obra_digital_tool_assignments for select to authenticated using (true);
create policy "obra_digital_tools_insert_auth" on public.obra_digital_tool_assignments for insert to authenticated with check (true);
create policy "obra_digital_tools_update_auth" on public.obra_digital_tool_assignments for update to authenticated using (true) with check (true);
create policy "obra_digital_tools_delete_auth" on public.obra_digital_tool_assignments for delete to authenticated using (true);

drop policy if exists "obra_digital_advances_select_anon" on public.obra_digital_monthly_advances;
drop policy if exists "obra_digital_advances_insert_anon" on public.obra_digital_monthly_advances;
drop policy if exists "obra_digital_advances_update_anon" on public.obra_digital_monthly_advances;
drop policy if exists "obra_digital_advances_delete_anon" on public.obra_digital_monthly_advances;
drop policy if exists "obra_digital_advances_select_auth" on public.obra_digital_monthly_advances;
drop policy if exists "obra_digital_advances_insert_auth" on public.obra_digital_monthly_advances;
drop policy if exists "obra_digital_advances_update_auth" on public.obra_digital_monthly_advances;
drop policy if exists "obra_digital_advances_delete_auth" on public.obra_digital_monthly_advances;

create policy "obra_digital_advances_select_anon" on public.obra_digital_monthly_advances for select to anon using (true);
create policy "obra_digital_advances_insert_anon" on public.obra_digital_monthly_advances for insert to anon with check (true);
create policy "obra_digital_advances_update_anon" on public.obra_digital_monthly_advances for update to anon using (true) with check (true);
create policy "obra_digital_advances_delete_anon" on public.obra_digital_monthly_advances for delete to anon using (true);
create policy "obra_digital_advances_select_auth" on public.obra_digital_monthly_advances for select to authenticated using (true);
create policy "obra_digital_advances_insert_auth" on public.obra_digital_monthly_advances for insert to authenticated with check (true);
create policy "obra_digital_advances_update_auth" on public.obra_digital_monthly_advances for update to authenticated using (true) with check (true);
create policy "obra_digital_advances_delete_auth" on public.obra_digital_monthly_advances for delete to authenticated using (true);

drop policy if exists "obra_digital_daily_select_anon" on public.obra_digital_daily_progress;
drop policy if exists "obra_digital_daily_insert_anon" on public.obra_digital_daily_progress;
drop policy if exists "obra_digital_daily_update_anon" on public.obra_digital_daily_progress;
drop policy if exists "obra_digital_daily_delete_anon" on public.obra_digital_daily_progress;
drop policy if exists "obra_digital_daily_select_auth" on public.obra_digital_daily_progress;
drop policy if exists "obra_digital_daily_insert_auth" on public.obra_digital_daily_progress;
drop policy if exists "obra_digital_daily_update_auth" on public.obra_digital_daily_progress;
drop policy if exists "obra_digital_daily_delete_auth" on public.obra_digital_daily_progress;

create policy "obra_digital_daily_select_anon" on public.obra_digital_daily_progress for select to anon using (true);
create policy "obra_digital_daily_insert_anon" on public.obra_digital_daily_progress for insert to anon with check (true);
create policy "obra_digital_daily_update_anon" on public.obra_digital_daily_progress for update to anon using (true) with check (true);
create policy "obra_digital_daily_delete_anon" on public.obra_digital_daily_progress for delete to anon using (true);
create policy "obra_digital_daily_select_auth" on public.obra_digital_daily_progress for select to authenticated using (true);
create policy "obra_digital_daily_insert_auth" on public.obra_digital_daily_progress for insert to authenticated with check (true);
create policy "obra_digital_daily_update_auth" on public.obra_digital_daily_progress for update to authenticated using (true) with check (true);
create policy "obra_digital_daily_delete_auth" on public.obra_digital_daily_progress for delete to authenticated using (true);

grant select, insert, update, delete on public.obra_digital_labor_contracts to anon, authenticated, service_role;
grant select, insert, update, delete on public.obra_digital_documents to anon, authenticated, service_role;
grant select, insert, update, delete on public.obra_digital_tool_assignments to anon, authenticated, service_role;
grant select, insert, update, delete on public.obra_digital_monthly_advances to anon, authenticated, service_role;
grant select, insert, update, delete on public.obra_digital_daily_progress to anon, authenticated, service_role;

notify pgrst, 'reload schema';
