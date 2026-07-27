-- Auditorías de Cumplimiento Legal (RRHH, SSO, etc.)

create table if not exists public.ci_legal_auditorias (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  estado text not null default 'completada'
    check (estado in ('en_proceso', 'completada', 'fallida')),
  puntaje numeric(5,2),
  resumen_ejecutivo text,
  metadata jsonb not null default '{}'::jsonb,
  realizada_por uuid,
  created_at timestamptz not null default now()
);

comment on table public.ci_legal_auditorias is
  'Registro de las auditorías o revisiones ejecutadas por el agente de cumplimiento.';

create table if not exists public.ci_legal_auditoria_resultados (
  id uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references public.ci_legal_auditorias(id) on delete cascade,
  obligacion_id uuid not null references public.ci_legal_obligaciones(id) on delete cascade,
  estado_cumplimiento text not null default 'no_evaluado'
    check (estado_cumplimiento in ('cumple', 'advertencia', 'no_cumple', 'no_evaluado')),
  hallazgos text,
  recomendacion text,
  detalles jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.ci_legal_auditoria_resultados is
  'Resultados individuales por cada obligación evaluada en una auditoría.';

alter table public.ci_legal_auditorias enable row level security;
alter table public.ci_legal_auditoria_resultados enable row level security;

drop policy if exists ci_legal_auditorias_select on public.ci_legal_auditorias;
create policy ci_legal_auditorias_select
  on public.ci_legal_auditorias for select to authenticated
  using (true);

drop policy if exists ci_legal_auditorias_insert on public.ci_legal_auditorias;
create policy ci_legal_auditorias_insert
  on public.ci_legal_auditorias for insert to authenticated
  with check (true);

drop policy if exists ci_legal_auditoria_resultados_select on public.ci_legal_auditoria_resultados;
create policy ci_legal_auditoria_resultados_select
  on public.ci_legal_auditoria_resultados for select to authenticated
  using (true);

drop policy if exists ci_legal_auditoria_resultados_insert on public.ci_legal_auditoria_resultados;
create policy ci_legal_auditoria_resultados_insert
  on public.ci_legal_auditoria_resultados for insert to authenticated
  with check (true);

notify pgrst, 'reload schema';
