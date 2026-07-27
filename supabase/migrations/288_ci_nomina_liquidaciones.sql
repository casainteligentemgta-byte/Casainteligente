-- Fase 4: Calculadora de Liquidaciones (LOTTT)

create table if not exists public.ci_nomina_liquidaciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.ci_empleados (id) on delete cascade,
  
  -- Fechas
  fecha_ingreso date not null,
  fecha_egreso date not null,
  
  -- Parámetros del cálculo
  motivo text not null check (motivo in ('renuncia', 'despido_injustificado', 'despido_justificado', 'mutuo_acuerdo')),
  salario_base_mensual numeric(15,2) not null,
  dias_utilidades integer not null default 30, -- Mínimo ley
  dias_bono_vacacional integer not null default 15, -- Mínimo ley + días adicionales
  
  -- Variables calculadas
  tiempo_servicio_meses numeric(8,2),
  salario_diario_normal numeric(15,2),
  salario_diario_integral numeric(15,2),
  
  -- Desglose de montos
  monto_garantia_prestaciones numeric(15,2) default 0, -- Art 142 A y B
  monto_prestaciones_retroactivas numeric(15,2) default 0, -- Art 142 C
  monto_prestaciones_pagar numeric(15,2) default 0, -- El mayor entre garantía y retroactivo
  
  monto_vacaciones_fraccionadas numeric(15,2) default 0,
  monto_bono_vacacional_fraccionado numeric(15,2) default 0,
  monto_utilidades_fraccionadas numeric(15,2) default 0,
  
  monto_indemnizacion_despido numeric(15,2) default 0, -- "Doblete" Art 92 si aplica
  
  monto_total numeric(15,2) not null,
  
  -- Estado y metadatos
  estado text not null default 'borrador' check (estado in ('borrador', 'aprobada', 'pagada')),
  observaciones text,
  creado_por uuid references auth.users (id),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_nomina_liquidaciones_empleado on public.ci_nomina_liquidaciones (empleado_id);

alter table public.ci_nomina_liquidaciones enable row level security;

drop policy if exists "ci_nomina_liquidaciones_select" on public.ci_nomina_liquidaciones;
create policy "ci_nomina_liquidaciones_select" on public.ci_nomina_liquidaciones for select to authenticated using (true);

drop policy if exists "ci_nomina_liquidaciones_insert" on public.ci_nomina_liquidaciones;
create policy "ci_nomina_liquidaciones_insert" on public.ci_nomina_liquidaciones for insert to authenticated with check (true);

drop policy if exists "ci_nomina_liquidaciones_update" on public.ci_nomina_liquidaciones;
create policy "ci_nomina_liquidaciones_update" on public.ci_nomina_liquidaciones for update to authenticated using (true) with check (true);

drop policy if exists "ci_nomina_liquidaciones_delete" on public.ci_nomina_liquidaciones;
create policy "ci_nomina_liquidaciones_delete" on public.ci_nomina_liquidaciones for delete to authenticated using (true);

-- Permisos
grant select, insert, update, delete on public.ci_nomina_liquidaciones to authenticated, service_role;

-- Notificar a PostgREST
notify pgrst, 'reload schema';
