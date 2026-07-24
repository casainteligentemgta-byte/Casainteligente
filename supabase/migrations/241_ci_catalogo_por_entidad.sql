-- Catálogo de materiales por entidad (patrono).
-- Backfill: inventario existente → Casa Inteligente; Dimáquinas catálogo vacío; nuevas entidades vía trigger.

-- ── Registro de catálogo por entidad ─────────────────────────────────
create table if not exists public.ci_catalogos_entidad (
  entidad_id uuid primary key references public.ci_entidades (id) on delete cascade,
  sap_prefijo text not null,
  created_at timestamptz not null default now()
);

comment on table public.ci_catalogos_entidad is
  'Catálogo lógico de materiales (global_inventory.entidad_id) por patrono. Se crea al registrar la entidad.';
comment on column public.ci_catalogos_entidad.sap_prefijo is
  'Prefijo SAP autogenerado para nuevos materiales de la entidad (ej. SAP, DIMA).';

create index if not exists idx_ci_catalogos_entidad_prefijo
  on public.ci_catalogos_entidad (sap_prefijo);

alter table public.ci_catalogos_entidad enable row level security;

drop policy if exists "ci_catalogos_entidad_select_anon" on public.ci_catalogos_entidad;
drop policy if exists "ci_catalogos_entidad_select_auth" on public.ci_catalogos_entidad;
create policy "ci_catalogos_entidad_select_anon"
  on public.ci_catalogos_entidad for select to anon using (true);
create policy "ci_catalogos_entidad_select_auth"
  on public.ci_catalogos_entidad for select to authenticated using (true);

-- ── Prefijo SAP por nombre de entidad ────────────────────────────────
create or replace function public.ci_catalogo_sap_prefijo_desde_nombre(p_nombre text)
returns text
language plpgsql
immutable
as $$
declare
  v_norm text;
  v_prefijo text;
begin
  v_norm := lower(trim(coalesce(p_nombre, '')));
  if v_norm = '' then
    return 'ENT';
  end if;
  if v_norm like '%casa inteligente%' then
    return 'SAP';
  end if;
  if v_norm like '%dimaquina%' or v_norm like '%dimáquina%' then
    return 'DIMA';
  end if;
  v_prefijo := upper(regexp_replace(v_norm, '[^a-z0-9]', '', 'g'));
  if length(v_prefijo) < 2 then
    return 'ENT';
  end if;
  return left(v_prefijo, 4);
end;
$$;

-- ── Inicializar catálogo al crear entidad ────────────────────────────
create or replace function public.ci_entidad_inicializar_catalogo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefijo text;
begin
  v_prefijo := public.ci_catalogo_sap_prefijo_desde_nombre(new.nombre);
  insert into public.ci_catalogos_entidad (entidad_id, sap_prefijo)
  values (new.id, v_prefijo)
  on conflict (entidad_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tr_ci_entidad_inicializar_catalogo on public.ci_entidades;
create trigger tr_ci_entidad_inicializar_catalogo
  after insert on public.ci_entidades
  for each row
  execute function public.ci_entidad_inicializar_catalogo();

-- ── Secuencias SAP por prefijo (DIMA-000001, etc.) ───────────────────
create table if not exists public.ci_catalogo_sap_secuencias (
  prefijo text primary key,
  ultimo_val bigint not null default 0
);

comment on table public.ci_catalogo_sap_secuencias is
  'Contador por prefijo SAP de entidad (complementa inventory_sap_seq legacy para Casa Inteligente).';

insert into public.ci_catalogo_sap_secuencias (prefijo, ultimo_val)
values ('SAP', coalesce((select last_value from public.inventory_sap_seq), 0))
on conflict (prefijo) do nothing;

-- ── Trigger SAP: respeta entidad_id → prefijo del catálogo ───────────
create or replace function public.global_inventory_set_sap()
returns trigger
language plpgsql
as $$
declare
  v_prefijo text;
  v_next bigint;
begin
  if new.sap_code is not null and trim(new.sap_code) <> '' then
    return new;
  end if;

  if new.entidad_id is not null then
    select c.sap_prefijo
      into v_prefijo
      from public.ci_catalogos_entidad c
     where c.entidad_id = new.entidad_id;

    if v_prefijo is null then
      select public.ci_catalogo_sap_prefijo_desde_nombre(e.nombre)
        into v_prefijo
        from public.ci_entidades e
       where e.id = new.entidad_id;
    end if;

    v_prefijo := coalesce(nullif(trim(v_prefijo), ''), 'ENT');

    insert into public.ci_catalogo_sap_secuencias (prefijo, ultimo_val)
    values (v_prefijo, 0)
    on conflict (prefijo) do nothing;

    update public.ci_catalogo_sap_secuencias
       set ultimo_val = ultimo_val + 1
     where prefijo = v_prefijo
     returning ultimo_val into v_next;

    new.sap_code := v_prefijo || '-' || lpad(v_next::text, 6, '0');
    return new;
  end if;

  new.sap_code := 'SAP-' || lpad(nextval('public.inventory_sap_seq')::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists tr_global_inventory_sap on public.global_inventory;
create trigger tr_global_inventory_sap
  before insert on public.global_inventory
  for each row
  execute function public.global_inventory_set_sap();

-- ── Entidades base: Casa Inteligente + Dimáquinas ────────────────────
do $$
declare
  v_casa_id uuid;
  v_dima_id uuid;
begin
  select id into v_casa_id
    from public.ci_entidades
   where lower(trim(nombre)) like '%casa inteligente%'
      or lower(coalesce(nombre_comercial, '')) like '%casa inteligente%'
   order by created_at
   limit 1;

  if v_casa_id is null then
    insert into public.ci_entidades (nombre, nombre_comercial, notas)
    values (
      'Casa Inteligente',
      'Casa Inteligente',
      'Patrono principal — catálogo de materiales heredado del inventario existente.'
    )
    returning id into v_casa_id;
  end if;

  select id into v_dima_id
    from public.ci_entidades
   where lower(trim(nombre)) like '%dimaquina%'
      or lower(trim(nombre)) like '%dimáquina%'
      or lower(coalesce(nombre_comercial, '')) like '%dimaquina%'
      or lower(coalesce(nombre_comercial, '')) like '%dimáquina%'
   order by created_at
   limit 1;

  if v_dima_id is null then
    insert into public.ci_entidades (nombre, nombre_comercial, notas)
    values (
      'Dimáquinas',
      'Dimáquinas',
      'Patrono Dimáquinas — catálogo de materiales independiente de Casa Inteligente.'
    )
    returning id into v_dima_id;
  end if;

  insert into public.ci_catalogos_entidad (entidad_id, sap_prefijo)
  values
    (v_casa_id, 'SAP'),
    (v_dima_id, 'DIMA')
  on conflict (entidad_id) do update
    set sap_prefijo = excluded.sap_prefijo;

  -- Materiales con proyecto: entidad del proyecto (si aplica)
  update public.global_inventory gi
     set entidad_id = p.entidad_id,
         updated_at = now()
    from public.ci_proyectos p
   where gi.proyecto_id = p.id
     and p.entidad_id is not null
     and gi.entidad_id is distinct from p.entidad_id
     and p.entidad_id <> v_casa_id;

  -- Resto del inventario histórico → Casa Inteligente
  update public.global_inventory
     set entidad_id = v_casa_id,
         updated_at = now()
   where entidad_id is null;

  -- Catálogo para entidades ya existentes sin registro
  insert into public.ci_catalogos_entidad (entidad_id, sap_prefijo)
  select e.id, public.ci_catalogo_sap_prefijo_desde_nombre(e.nombre)
    from public.ci_entidades e
   where not exists (
     select 1 from public.ci_catalogos_entidad c where c.entidad_id = e.id
   )
  on conflict (entidad_id) do nothing;
end;
$$;

notify pgrst, 'reload schema';
