-- Enrutamiento Telegram almacén: depositario por obra + grupo opcional + respaldo global.

alter table public.ci_proyectos
  add column if not exists depositario_id uuid
  references public.ci_empleados (id) on delete set null;

alter table public.ci_proyectos
  add column if not exists telegram_grupo_almacen_id bigint;

create index if not exists idx_ci_proyectos_depositario
  on public.ci_proyectos (depositario_id)
  where depositario_id is not null;

comment on column public.ci_proyectos.depositario_id is
  'Depositario de obra (RRHH). Recibe alertas de cuarentena vía chat individual.';
comment on column public.ci_proyectos.telegram_grupo_almacen_id is
  'Chat ID del grupo Telegram de almacén/logística de esta obra (avisos informativos).';

alter table public.ci_empleados
  add column if not exists alertas_almacen_global boolean not null default false;

comment on column public.ci_empleados.alertas_almacen_global is
  'Si true, recibe alertas de cuarentena sin enrutamiento por obra (almacén central / respaldo).';

notify pgrst, 'reload schema';
