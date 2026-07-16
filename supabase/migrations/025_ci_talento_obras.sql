-- CASA INTELIGENTE — Talento, obras y contratos (prefijo ci_ para no chocar con tablas legacy).
-- Ejecutar en Supabase si aún no existen. Ajusta RLS según tu política de Auth.

-- ── Empleados / evaluación ─────────────────────────────────────────
create table if not exists public.ci_empleados (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  email text,
  documento text,
  telefono text,
  rol_examen text not null check (rol_examen in ('programador', 'tecnico')),
  respuestas_personalidad jsonb not null default '[]'::jsonb,
  respuestas_logica jsonb not null default '[]'::jsonb,
  puntaje_personalidad numeric(6,2),
  puntaje_logica numeric(6,2),
  puntaje_total numeric(6,2),
  semaforo text check (semaforo in ('verde', 'amarillo', 'rojo')),
  estado text not null default 'evaluacion_pendiente'
    check (estado in ('evaluacion_pendiente', 'aprobado', 'rechazado')),
  examen_inicio_at timestamptz,
  examen_completado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_empleados_estado on public.ci_empleados (estado);
create index if not exists idx_ci_empleados_semaforo on public.ci_empleados (semaforo);

-- ── Obras ─────────────────────────────────────────────────────────
create table if not exists public.ci_obras (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  ubicacion text,
  cliente text,
  fecha_inicio date,
  fecha_entrega_prometida date not null,
  avance_porcentaje numeric(5,2) not null default 0 check (avance_porcentaje >= 0 and avance_porcentaje <= 100),
  precio_venta_usd numeric(14,2),
  penalizacion_diaria_usd numeric(14,2) not null default 0,
  estado text not null default 'activa' check (estado in ('activa', 'cerrada')),
  fecha_cierre timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_obras_estado on public.ci_obras (estado);

-- ── Materiales por obra ───────────────────────────────────────────
create table if not exists public.ci_materiales_obra (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.ci_obras (id) on delete cascade,
  concepto text not null,
  costo_usd numeric(14,2) not null default 0,
  registrado_en date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_materiales_obra_obra on public.ci_materiales_obra (obra_id);

-- ── Asignación empleado ↔ obra (honorarios / multas) ───────────────
create table if not exists public.ci_obra_empleados (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.ci_obras (id) on delete cascade,
  empleado_id uuid not null references public.ci_empleados (id) on delete restrict,
  honorarios_acordados_usd numeric(14,2) not null default 0,
  multas_acumuladas_usd numeric(14,2) not null default 0,
  pago_final_efectivo_usd numeric(14,2),
  unique (obra_id, empleado_id)
);

create index if not exists idx_ci_obra_empleados_obra on public.ci_obra_empleados (obra_id);

-- ── Contratos generados (modelo legal) ───────────────────────────
create table if not exists public.ci_contratos_empleado_obra (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.ci_empleados (id) on delete restrict,
  obra_id uuid not null references public.ci_obras (id) on delete restrict,
  monto_acordado_usd numeric(14,2) not null,
  porcentaje_inicial numeric(5,2) not null check (porcentaje_inicial >= 0 and porcentaje_inicial <= 100),
  texto_legal text not null,
  created_at timestamptz not null default now()
);

-- RLS (anon + authenticated, como inventario/productos)
alter table public.ci_empleados enable row level security;
alter table public.ci_obras enable row level security;
alter table public.ci_materiales_obra enable row level security;
alter table public.ci_obra_empleados enable row level security;
alter table public.ci_contratos_empleado_obra enable row level security;

-- ci_empleados
drop policy if exists "ci_empleados_select_anon" on public.ci_empleados;
drop policy if exists "ci_empleados_insert_anon" on public.ci_empleados;
drop policy if exists "ci_empleados_update_anon" on public.ci_empleados;
drop policy if exists "ci_empleados_delete_anon" on public.ci_empleados;
drop policy if exists "ci_empleados_select_auth" on public.ci_empleados;
drop policy if exists "ci_empleados_insert_auth" on public.ci_empleados;
drop policy if exists "ci_empleados_update_auth" on public.ci_empleados;
drop policy if exists "ci_empleados_delete_auth" on public.ci_empleados;
create policy "ci_empleados_select_anon" on public.ci_empleados for select to anon using (true);
create policy "ci_empleados_insert_anon" on public.ci_empleados for insert to anon with check (true);
create policy "ci_empleados_update_anon" on public.ci_empleados for update to anon using (true) with check (true);
create policy "ci_empleados_delete_anon" on public.ci_empleados for delete to anon using (true);
create policy "ci_empleados_select_auth" on public.ci_empleados for select to authenticated using (true);
create policy "ci_empleados_insert_auth" on public.ci_empleados for insert to authenticated with check (true);
create policy "ci_empleados_update_auth" on public.ci_empleados for update to authenticated using (true) with check (true);
create policy "ci_empleados_delete_auth" on public.ci_empleados for delete to authenticated using (true);

-- ci_obras
drop policy if exists "ci_obras_select_anon" on public.ci_obras;
drop policy if exists "ci_obras_insert_anon" on public.ci_obras;
drop policy if exists "ci_obras_update_anon" on public.ci_obras;
drop policy if exists "ci_obras_delete_anon" on public.ci_obras;
drop policy if exists "ci_obras_select_auth" on public.ci_obras;
drop policy if exists "ci_obras_insert_auth" on public.ci_obras;
drop policy if exists "ci_obras_update_auth" on public.ci_obras;
drop policy if exists "ci_obras_delete_auth" on public.ci_obras;
create policy "ci_obras_select_anon" on public.ci_obras for select to anon using (true);
create policy "ci_obras_insert_anon" on public.ci_obras for insert to anon with check (true);
create policy "ci_obras_update_anon" on public.ci_obras for update to anon using (true) with check (true);
create policy "ci_obras_delete_anon" on public.ci_obras for delete to anon using (true);
create policy "ci_obras_select_auth" on public.ci_obras for select to authenticated using (true);
create policy "ci_obras_insert_auth" on public.ci_obras for insert to authenticated with check (true);
create policy "ci_obras_update_auth" on public.ci_obras for update to authenticated using (true) with check (true);
create policy "ci_obras_delete_auth" on public.ci_obras for delete to authenticated using (true);

-- ci_materiales_obra
drop policy if exists "ci_mat_select_anon" on public.ci_materiales_obra;
drop policy if exists "ci_mat_insert_anon" on public.ci_materiales_obra;
drop policy if exists "ci_mat_update_anon" on public.ci_materiales_obra;
drop policy if exists "ci_mat_delete_anon" on public.ci_materiales_obra;
drop policy if exists "ci_mat_select_auth" on public.ci_materiales_obra;
drop policy if exists "ci_mat_insert_auth" on public.ci_materiales_obra;
drop policy if exists "ci_mat_update_auth" on public.ci_materiales_obra;
drop policy if exists "ci_mat_delete_auth" on public.ci_materiales_obra;
create policy "ci_mat_select_anon" on public.ci_materiales_obra for select to anon using (true);
create policy "ci_mat_insert_anon" on public.ci_materiales_obra for insert to anon with check (true);
create policy "ci_mat_update_anon" on public.ci_materiales_obra for update to anon using (true) with check (true);
create policy "ci_mat_delete_anon" on public.ci_materiales_obra for delete to anon using (true);
create policy "ci_mat_select_auth" on public.ci_materiales_obra for select to authenticated using (true);
create policy "ci_mat_insert_auth" on public.ci_materiales_obra for insert to authenticated with check (true);
create policy "ci_mat_update_auth" on public.ci_materiales_obra for update to authenticated using (true) with check (true);
create policy "ci_mat_delete_auth" on public.ci_materiales_obra for delete to authenticated using (true);

-- ci_obra_empleados
drop policy if exists "ci_oe_select_anon" on public.ci_obra_empleados;
drop policy if exists "ci_oe_insert_anon" on public.ci_obra_empleados;
drop policy if exists "ci_oe_update_anon" on public.ci_obra_empleados;
drop policy if exists "ci_oe_delete_anon" on public.ci_obra_empleados;
drop policy if exists "ci_oe_select_auth" on public.ci_obra_empleados;
drop policy if exists "ci_oe_insert_auth" on public.ci_obra_empleados;
drop policy if exists "ci_oe_update_auth" on public.ci_obra_empleados;
drop policy if exists "ci_oe_delete_auth" on public.ci_obra_empleados;
create policy "ci_oe_select_anon" on public.ci_obra_empleados for select to anon using (true);
create policy "ci_oe_insert_anon" on public.ci_obra_empleados for insert to anon with check (true);
create policy "ci_oe_update_anon" on public.ci_obra_empleados for update to anon using (true) with check (true);
create policy "ci_oe_delete_anon" on public.ci_obra_empleados for delete to anon using (true);
create policy "ci_oe_select_auth" on public.ci_obra_empleados for select to authenticated using (true);
create policy "ci_oe_insert_auth" on public.ci_obra_empleados for insert to authenticated with check (true);
create policy "ci_oe_update_auth" on public.ci_obra_empleados for update to authenticated using (true) with check (true);
create policy "ci_oe_delete_auth" on public.ci_obra_empleados for delete to authenticated using (true);

-- ci_contratos_empleado_obra
drop policy if exists "ci_ctr_select_anon" on public.ci_contratos_empleado_obra;
drop policy if exists "ci_ctr_insert_anon" on public.ci_contratos_empleado_obra;
drop policy if exists "ci_ctr_update_anon" on public.ci_contratos_empleado_obra;
drop policy if exists "ci_ctr_delete_anon" on public.ci_contratos_empleado_obra;
drop policy if exists "ci_ctr_select_auth" on public.ci_contratos_empleado_obra;
drop policy if exists "ci_ctr_insert_auth" on public.ci_contratos_empleado_obra;
drop policy if exists "ci_ctr_update_auth" on public.ci_contratos_empleado_obra;
drop policy if exists "ci_ctr_delete_auth" on public.ci_contratos_empleado_obra;
create policy "ci_ctr_select_anon" on public.ci_contratos_empleado_obra for select to anon using (true);
create policy "ci_ctr_insert_anon" on public.ci_contratos_empleado_obra for insert to anon with check (true);
create policy "ci_ctr_update_anon" on public.ci_contratos_empleado_obra for update to anon using (true) with check (true);
create policy "ci_ctr_delete_anon" on public.ci_contratos_empleado_obra for delete to anon using (true);
create policy "ci_ctr_select_auth" on public.ci_contratos_empleado_obra for select to authenticated using (true);
create policy "ci_ctr_insert_auth" on public.ci_contratos_empleado_obra for insert to authenticated with check (true);
create policy "ci_ctr_update_auth" on public.ci_contratos_empleado_obra for update to authenticated using (true) with check (true);
create policy "ci_ctr_delete_auth" on public.ci_contratos_empleado_obra for delete to authenticated using (true);
