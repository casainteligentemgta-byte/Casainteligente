-- Maquinaria propia a nivel de entidad (catálogo del patrono) + vínculo entidad_id.

alter table public.ci_proyecto_equipos
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete cascade;

alter table public.ci_proyecto_equipos
  alter column proyecto_id drop not null;

update public.ci_proyecto_equipos e
set entidad_id = p.entidad_id
from public.ci_proyectos p
where e.proyecto_id = p.id
  and e.entidad_id is null
  and p.entidad_id is not null;

alter table public.ci_proyecto_equipos
  drop constraint if exists ci_proyecto_equipos_owner_chk;

alter table public.ci_proyecto_equipos
  add constraint ci_proyecto_equipos_owner_chk
  check (proyecto_id is not null or entidad_id is not null);

create index if not exists idx_ci_proyecto_equipos_entidad_categoria
  on public.ci_proyecto_equipos (entidad_id, categoria)
  where entidad_id is not null;

comment on column public.ci_proyecto_equipos.entidad_id is
  'Patrono dueño del activo. Obligatorio en maquinaria propia de catálogo (proyecto_id puede ser null).';

comment on column public.ci_proyecto_equipos.proyecto_id is
  'Obra. Null solo para maquinaria propia registrada en el menú de la entidad.';

notify pgrst, 'reload schema';
