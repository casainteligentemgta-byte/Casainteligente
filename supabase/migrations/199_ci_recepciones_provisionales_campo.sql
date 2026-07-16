-- Ficha de Recepción de Materiales (FRM) · ingresos provisionales de campo (nota / emergencia).
-- Nota: el slot 196 está ocupado por 196_compras_entidad_destino.sql.

-- ── Encabezado FRM ───────────────────────────────────────────────────────────
create table if not exists public.ci_recepciones_campo (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete restrict,
  ubicacion_id uuid not null references public.inv_ubicaciones (id) on delete restrict,
  proveedor_id uuid references public.empresas (id) on delete set null,
  proveedor_nombre text not null default '',
  tipo varchar(32) not null
    check (tipo in ('nota_entrega', 'emergencia', 'factura_canal')),
  num_doc varchar(120) not null default '',
  estado varchar(24) not null default 'registrado'
    check (estado in ('registrado', 'anulado')),
  soporte_storage_path text,
  soporte_file_name text,
  soporte_mime_type text,
  observaciones text,
  factura_canal_pendiente_id uuid references public.ci_facturas_canal_pendientes (id) on delete set null,
  registrado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_recepciones_campo_proyecto
  on public.ci_recepciones_campo (proyecto_id, created_at desc);

create index if not exists idx_ci_recepciones_campo_ubicacion
  on public.ci_recepciones_campo (ubicacion_id);

create index if not exists idx_ci_recepciones_campo_tipo
  on public.ci_recepciones_campo (tipo, created_at desc);

comment on table public.ci_recepciones_campo is
  'FRM: recepciones provisionales en obra (nota sin factura, emergencia sin papeles, enlace canal).';

-- ── Detalle FRM ────────────────────────────────────────────────────────────────
create table if not exists public.ci_recepciones_campo_lineas (
  id uuid primary key default gen_random_uuid(),
  recepcion_id uuid not null references public.ci_recepciones_campo (id) on delete cascade,
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  cantidad numeric(15, 4) not null check (cantidad > 0),
  unidad text not null default 'UND',
  descripcion text not null default '',
  observaciones text,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_recepciones_campo_lineas_recepcion
  on public.ci_recepciones_campo_lineas (recepcion_id);

comment on table public.ci_recepciones_campo_lineas is
  'Líneas de material recibidas en campo (SKU global_inventory).';

-- ── RPC ingreso manual + stock ─────────────────────────────────────────────────
create or replace function public.ci_registrar_ingreso_manual_campo(
  p_proyecto_id uuid,
  p_ubicacion_id uuid,
  p_proveedor_id uuid,
  p_tipo varchar,
  p_num_doc varchar,
  p_lineas jsonb,
  p_usuario_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recepcion_id uuid;
  v_line jsonb;
  v_material_id uuid;
  v_cantidad numeric;
  v_unidad text;
  v_descripcion text;
  v_obs text;
  v_orden integer := 0;
  v_tipo text;
begin
  if p_proyecto_id is null or p_ubicacion_id is null then
    raise exception 'proyecto_id y ubicacion_id son obligatorios';
  end if;

  v_tipo := lower(trim(coalesce(p_tipo, '')));
  if v_tipo not in ('nota_entrega', 'emergencia', 'factura_canal') then
    raise exception 'tipo inválido: %', p_tipo;
  end if;

  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Debe indicar al menos una línea de material';
  end if;

  if not exists (select 1 from public.ci_proyectos where id = p_proyecto_id) then
    raise exception 'Proyecto no encontrado';
  end if;

  if not exists (
    select 1 from public.inv_ubicaciones u
    where u.id = p_ubicacion_id and u.activo = true
  ) then
    raise exception 'Ubicación de inventario no encontrada o inactiva';
  end if;

  if p_proveedor_id is not null and not exists (select 1 from public.empresas where id = p_proveedor_id) then
    raise exception 'Proveedor (empresa) no encontrado';
  end if;

  insert into public.ci_recepciones_campo (
    proyecto_id,
    ubicacion_id,
    proveedor_id,
    tipo,
    num_doc,
    registrado_por,
    estado
  )
  values (
    p_proyecto_id,
    p_ubicacion_id,
    p_proveedor_id,
    v_tipo,
    coalesce(nullif(trim(p_num_doc), ''), 'S/N'),
    p_usuario_id,
    'registrado'
  )
  returning id into v_recepcion_id;

  for v_line in select value from jsonb_array_elements(p_lineas)
  loop
    v_material_id := nullif(trim(v_line->>'material_id'), '')::uuid;
    v_cantidad := (v_line->>'cantidad')::numeric;
    v_unidad := coalesce(nullif(trim(v_line->>'unidad'), ''), 'UND');
    v_descripcion := coalesce(nullif(trim(v_line->>'descripcion'), ''), '');
    v_obs := nullif(trim(v_line->>'observaciones'), '');

    if v_material_id is null then
      raise exception 'Cada línea debe incluir material_id válido';
    end if;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida en línea de material %', v_material_id;
    end if;
    if not exists (select 1 from public.global_inventory where id = v_material_id) then
      raise exception 'Material % no existe en global_inventory', v_material_id;
    end if;

    if v_descripcion = '' then
      select coalesce(g.name, 'Material') into v_descripcion
      from public.global_inventory g where g.id = v_material_id;
    end if;

    v_orden := v_orden + 1;

    insert into public.ci_recepciones_campo_lineas (
      recepcion_id,
      material_id,
      cantidad,
      unidad,
      descripcion,
      observaciones,
      orden
    )
    values (
      v_recepcion_id,
      v_material_id,
      v_cantidad,
      v_unidad,
      v_descripcion,
      v_obs,
      v_orden
    );

    perform public.inv_stock_apply_delta(p_ubicacion_id, v_material_id, v_cantidad, 0, 0);
  end loop;

  return v_recepcion_id;
end;
$$;

comment on function public.ci_registrar_ingreso_manual_campo is
  'FRM: registra recepción provisional en campo e incrementa inventario_stock vía inv_stock_apply_delta.';

grant execute on function public.ci_registrar_ingreso_manual_campo(
  uuid, uuid, uuid, varchar, varchar, jsonb, uuid
) to authenticated, service_role, anon;

alter table public.ci_recepciones_campo enable row level security;
alter table public.ci_recepciones_campo_lineas enable row level security;

drop policy if exists "ci_recepciones_campo_select" on public.ci_recepciones_campo;
drop policy if exists "ci_recepciones_campo_insert" on public.ci_recepciones_campo;
drop policy if exists "ci_recepciones_campo_update" on public.ci_recepciones_campo;
drop policy if exists "ci_recepciones_campo_lineas_select" on public.ci_recepciones_campo_lineas;
drop policy if exists "ci_recepciones_campo_lineas_insert" on public.ci_recepciones_campo_lineas;

create policy "ci_recepciones_campo_select"
  on public.ci_recepciones_campo for select to authenticated, anon using (true);
create policy "ci_recepciones_campo_insert"
  on public.ci_recepciones_campo for insert to authenticated, anon with check (true);
create policy "ci_recepciones_campo_update"
  on public.ci_recepciones_campo for update to authenticated, anon using (true) with check (true);

create policy "ci_recepciones_campo_lineas_select"
  on public.ci_recepciones_campo_lineas for select to authenticated, anon using (true);
create policy "ci_recepciones_campo_lineas_insert"
  on public.ci_recepciones_campo_lineas for insert to authenticated, anon with check (true);

notify pgrst, 'reload schema';
