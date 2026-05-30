-- Egresos de material en campo: trazabilidad obrero, partida, tarea cronograma (Telegram /salida y app).

create table if not exists public.inv_egresos_campo (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete restrict,
  origen_ubicacion_id uuid not null references public.inv_ubicaciones (id) on delete restrict,
  destino_ubicacion_id uuid references public.inv_ubicaciones (id) on delete set null,
  transferencia_id uuid references public.transferencias_inventario (id) on delete set null,
  obrero_empleado_id uuid references public.ci_empleados (id) on delete set null,
  obrero_nombre text not null,
  obrero_oficio text,
  observaciones text not null default '',
  foto_storage_path text,
  foto_url text,
  fecha_egreso date not null default (timezone('America/Caracas', now()))::date,
  hora_egreso time not null default (timezone('America/Caracas', now()))::time,
  chat_id text,
  telegram_user_id text,
  telegram_username text,
  ci_obra_movimiento_id uuid references public.ci_obra_movimientos_material (id) on delete set null,
  stock_aplicado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_egresos_campo_proyecto_fecha
  on public.inv_egresos_campo (proyecto_id, fecha_egreso desc, created_at desc);

create index if not exists idx_inv_egresos_campo_transferencia
  on public.inv_egresos_campo (transferencia_id)
  where transferencia_id is not null;

create index if not exists idx_inv_egresos_campo_obrero
  on public.inv_egresos_campo (obrero_empleado_id)
  where obrero_empleado_id is not null;

comment on table public.inv_egresos_campo is
  'Cabecera de egreso de material a obra con trazabilidad de obrero, partida y actividad.';

create table if not exists public.inv_egresos_campo_lineas (
  id uuid primary key default gen_random_uuid(),
  egreso_id uuid not null references public.inv_egresos_campo (id) on delete cascade,
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  cantidad numeric(15, 4) not null check (cantidad > 0),
  unidad text not null default 'UND',
  ci_presupuesto_partida_id uuid references public.ci_presupuesto_partidas (id) on delete set null,
  partida_id uuid references public.partidas (id) on delete set null,
  cronograma_tarea_id uuid references public.cronograma_tareas (id) on delete set null,
  partida_label text,
  tarea_label text,
  material_nombre text,
  transferencia_linea_id uuid references public.transferencias_inventario_lineas (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_egresos_campo_lineas_egreso
  on public.inv_egresos_campo_lineas (egreso_id);

create index if not exists idx_inv_egresos_campo_lineas_material
  on public.inv_egresos_campo_lineas (material_id, created_at desc);

comment on table public.inv_egresos_campo_lineas is
  'Detalle de egreso: material, cantidad, partida presupuesto y tarea Gantt.';

alter table public.inv_egresos_campo enable row level security;
alter table public.inv_egresos_campo_lineas enable row level security;

drop policy if exists "inv_egresos_campo_select_anon" on public.inv_egresos_campo;
drop policy if exists "inv_egresos_campo_insert_anon" on public.inv_egresos_campo;
drop policy if exists "inv_egresos_campo_select_authenticated" on public.inv_egresos_campo;
drop policy if exists "inv_egresos_campo_insert_authenticated" on public.inv_egresos_campo;

create policy "inv_egresos_campo_select_anon"
  on public.inv_egresos_campo for select to anon using (true);
create policy "inv_egresos_campo_insert_anon"
  on public.inv_egresos_campo for insert to anon with check (true);
create policy "inv_egresos_campo_select_authenticated"
  on public.inv_egresos_campo for select to authenticated using (true);
create policy "inv_egresos_campo_insert_authenticated"
  on public.inv_egresos_campo for insert to authenticated with check (true);

drop policy if exists "inv_egresos_campo_lineas_select_anon" on public.inv_egresos_campo_lineas;
drop policy if exists "inv_egresos_campo_lineas_insert_anon" on public.inv_egresos_campo_lineas;
drop policy if exists "inv_egresos_campo_lineas_select_authenticated" on public.inv_egresos_campo_lineas;
drop policy if exists "inv_egresos_campo_lineas_insert_authenticated" on public.inv_egresos_campo_lineas;

create policy "inv_egresos_campo_lineas_select_anon"
  on public.inv_egresos_campo_lineas for select to anon using (true);
create policy "inv_egresos_campo_lineas_insert_anon"
  on public.inv_egresos_campo_lineas for insert to anon with check (true);
create policy "inv_egresos_campo_lineas_select_authenticated"
  on public.inv_egresos_campo_lineas for select to authenticated using (true);
create policy "inv_egresos_campo_lineas_insert_authenticated"
  on public.inv_egresos_campo_lineas for insert to authenticated with check (true);

notify pgrst, 'reload schema';
