-- Enlaces temporales de expediente / hoja de vida (validación vía API con service_role).

create table if not exists public.expediente_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  hoja_vida_id uuid not null references public.ci_empleados (id) on delete cascade,
  expires_at timestamptz not null,
  is_used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_expediente_tokens_token
  on public.expediente_tokens (token);

create index if not exists idx_expediente_tokens_hoja_vida
  on public.expediente_tokens (hoja_vida_id);

comment on table public.expediente_tokens is
  'Token de enlace público (onboarding / expediente). Expira o queda invalidado al marcar is_used.';

comment on column public.expediente_tokens.hoja_vida_id is
  'Referencia a ci_empleados (expediente del obrero).';

-- Vista para respuestas API con nombre y cargo legibles.
create or replace view public.hojas_vida as
select
  e.id,
  coalesce(nullif(btrim(e.nombre_completo), ''), 'Sin nombre') as nombre,
  coalesce(
    nullif(btrim(e.cargo_nombre), ''),
    nullif(btrim(e.cargo), ''),
    nullif(btrim(e.rol_buscado), ''),
    'Por definir'
  ) as cargo
from public.ci_empleados e;

comment on view public.hojas_vida is
  'Proyección de ci_empleados para enlaces de expediente (nombre + cargo).';

notify pgrst, 'reload schema';
