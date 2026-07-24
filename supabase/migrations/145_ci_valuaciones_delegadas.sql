-- Valuaciones delegadas: agrupa compras de proyecto y nómina de obra en un periodo.

create table if not exists public.ci_valuaciones_delegadas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  numero integer not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  porcentaje_honorarios numeric(5, 2) not null default 10,
  total_costo_materiales numeric(15, 2) not null default 0,
  total_costo_nomina numeric(15, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (proyecto_id, numero)
);

create index if not exists idx_ci_valuaciones_delegadas_proyecto
  on public.ci_valuaciones_delegadas (proyecto_id, numero desc);

comment on table public.ci_valuaciones_delegadas is
  'Valuación por periodo de costos de materiales y nómina imputados a un proyecto.';

-- Compras de proyecto (alias lógico sobre contabilidad_compras con proyecto_id).
alter table public.contabilidad_compras
  add column if not exists valuacion_delegada_id uuid references public.ci_valuaciones_delegadas (id) on delete set null;

create index if not exists idx_contabilidad_compras_valuacion
  on public.contabilidad_compras (valuacion_delegada_id);

create or replace view public.ci_compras as
select
  id,
  proyecto_id,
  total_amount as monto_total,
  fecha as fecha_factura,
  valuacion_delegada_id
from public.contabilidad_compras
where proyecto_id is not null;

comment on view public.ci_compras is
  'Compras imputadas a proyecto (vista sobre contabilidad_compras).';

-- Pagos de nómina por obra y fecha (varios movimientos por empleado).
create table if not exists public.ci_obra_nomina_pagos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.ci_proyectos (id) on delete cascade,
  empleado_id uuid references public.ci_empleados (id) on delete set null,
  costo_hour_estimado numeric(15, 4) not null default 0,
  horas_trabajadas numeric(10, 2) not null default 0,
  fecha_pago date not null,
  valuacion_delegada_id uuid references public.ci_valuaciones_delegadas (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_obra_nomina_pagos_obra_fecha
  on public.ci_obra_nomina_pagos (obra_id, fecha_pago);

create index if not exists idx_ci_obra_nomina_pagos_valuacion
  on public.ci_obra_nomina_pagos (valuacion_delegada_id);

comment on table public.ci_obra_nomina_pagos is
  'Movimientos de nómina por obra y fecha para valuaciones delegadas.';

alter table public.ci_valuaciones_delegadas enable row level security;
alter table public.ci_obra_nomina_pagos enable row level security;

drop policy if exists "ci_valuaciones_select_anon" on public.ci_valuaciones_delegadas;
drop policy if exists "ci_valuaciones_insert_anon" on public.ci_valuaciones_delegadas;
drop policy if exists "ci_valuaciones_update_anon" on public.ci_valuaciones_delegadas;
drop policy if exists "ci_nomina_pagos_select_anon" on public.ci_obra_nomina_pagos;
drop policy if exists "ci_nomina_pagos_insert_anon" on public.ci_obra_nomina_pagos;
drop policy if exists "ci_nomina_pagos_update_anon" on public.ci_obra_nomina_pagos;

create policy "ci_valuaciones_select_anon" on public.ci_valuaciones_delegadas for select to anon using (true);
create policy "ci_valuaciones_insert_anon" on public.ci_valuaciones_delegadas for insert to anon with check (true);
create policy "ci_valuaciones_update_anon" on public.ci_valuaciones_delegadas for update to anon using (true) with check (true);

create policy "ci_nomina_pagos_select_anon" on public.ci_obra_nomina_pagos for select to anon using (true);
create policy "ci_nomina_pagos_insert_anon" on public.ci_obra_nomina_pagos for insert to anon with check (true);
create policy "ci_nomina_pagos_update_anon" on public.ci_obra_nomina_pagos for update to anon using (true) with check (true);

notify pgrst, 'reload schema';
