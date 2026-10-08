-- 337 · Expediente laboral = cédula.
-- Queda en la obra (ci_empleados / contrato) y se indexa también en la entidad.

alter table public.ci_empleados
  add column if not exists expediente_cedula text;

alter table public.ci_empleados
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

comment on column public.ci_empleados.expediente_cedula is
  'Expediente del trabajador: cédula normalizada (V-12345678). Vive en la obra.';
comment on column public.ci_empleados.entidad_id is
  'Entidad (patrono) de la obra donde está el expediente. El detalle sigue en la obra.';

create index if not exists idx_ci_empleados_expediente_cedula
  on public.ci_empleados (expediente_cedula)
  where expediente_cedula is not null;

create index if not exists idx_ci_empleados_entidad
  on public.ci_empleados (entidad_id)
  where entidad_id is not null;

alter table public.ci_contratos_empleado_obra
  add column if not exists expediente_cedula text;

comment on column public.ci_contratos_empleado_obra.expediente_cedula is
  'Expediente del contrato: cédula del trabajador.';

create index if not exists idx_ci_contratos_empleado_obra_expediente
  on public.ci_contratos_empleado_obra (expediente_cedula)
  where expediente_cedula is not null;

create table if not exists public.ci_entidad_expedientes (
  id uuid primary key default gen_random_uuid(),
  entidad_id uuid not null references public.ci_entidades (id) on delete cascade,
  cedula_norm text not null,
  expediente_cedula text not null,
  empleado_id uuid references public.ci_empleados (id) on delete set null,
  proyecto_modulo_id uuid references public.ci_proyectos (id) on delete set null,
  nombre_completo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_entidad_expedientes_entidad_cedula unique (entidad_id, cedula_norm)
);

create index if not exists idx_ci_entidad_expedientes_cedula
  on public.ci_entidad_expedientes (cedula_norm);

create index if not exists idx_ci_entidad_expedientes_empleado
  on public.ci_entidad_expedientes (empleado_id)
  where empleado_id is not null;

comment on table public.ci_entidad_expedientes is
  'Índice de expedientes por entidad (cédula). El expediente completo vive en la obra.';

create or replace function public.actualizar_updated_at_ci_entidad_expedientes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tr_ci_entidad_expedientes_updated on public.ci_entidad_expedientes;
create trigger tr_ci_entidad_expedientes_updated
  before update on public.ci_entidad_expedientes
  for each row execute function public.actualizar_updated_at_ci_entidad_expedientes();

alter table public.ci_entidad_expedientes enable row level security;

drop policy if exists "ci_entidad_expedientes_all_auth" on public.ci_entidad_expedientes;
create policy "ci_entidad_expedientes_all_auth" on public.ci_entidad_expedientes
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.ci_entidad_expedientes to authenticated, service_role;

-- Rellena expediente_cedula en obra y el índice de entidad a partir de lo ya cargado.
update public.ci_empleados e
set expediente_cedula = case
    when upper(regexp_replace(coalesce(e.cedula, e.documento, ''), '[^0-9VE]', '', 'g')) ~ '^[VE][0-9]{5,9}$'
      then regexp_replace(
        upper(regexp_replace(coalesce(e.cedula, e.documento, ''), '[^0-9VE]', '', 'g')),
        '^([VE])([0-9]+)$',
        '\1-\2'
      )
    when regexp_replace(coalesce(e.cedula, e.documento, ''), '\D', '', 'g') ~ '^[0-9]{5,9}$'
      then 'V-' || regexp_replace(coalesce(e.cedula, e.documento, ''), '\D', '', 'g')
    else e.expediente_cedula
  end
where e.expediente_cedula is null
  and coalesce(e.cedula, e.documento, '') <> '';

update public.ci_empleados e
set entidad_id = p.entidad_id
from public.ci_proyectos p
where e.proyecto_modulo_id = p.id
  and e.entidad_id is null
  and p.entidad_id is not null;

insert into public.ci_entidad_expedientes (
  entidad_id, cedula_norm, expediente_cedula, empleado_id, proyecto_modulo_id, nombre_completo
)
select distinct on (p.entidad_id, upper(regexp_replace(coalesce(e.expediente_cedula, ''), '[^0-9VE]', '', 'g')))
  p.entidad_id,
  upper(regexp_replace(coalesce(e.expediente_cedula, ''), '[^0-9VE]', '', 'g')),
  e.expediente_cedula,
  e.id,
  e.proyecto_modulo_id,
  e.nombre_completo
from public.ci_empleados e
join public.ci_proyectos p on p.id = e.proyecto_modulo_id
where p.entidad_id is not null
  and e.expediente_cedula is not null
  and length(regexp_replace(e.expediente_cedula, '\D', '', 'g')) >= 5
order by p.entidad_id, upper(regexp_replace(coalesce(e.expediente_cedula, ''), '[^0-9VE]', '', 'g')), e.created_at desc
on conflict (entidad_id, cedula_norm) do nothing;

notify pgrst, 'reload schema';
