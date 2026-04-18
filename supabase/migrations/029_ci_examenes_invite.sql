-- Enlaces de examen con token y caducidad (15 min desde generación).

create table if not exists public.ci_examenes (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.ci_empleados (id) on delete cascade,
  token text not null unique,
  expira_at timestamptz not null,
  usado_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_examenes_token on public.ci_examenes (token);
create index if not exists idx_ci_examenes_empleado on public.ci_examenes (empleado_id);

alter table public.ci_examenes enable row level security;

-- Solo acceso vía service role / backend; PostgREST con anon no expone filas sin políticas.
