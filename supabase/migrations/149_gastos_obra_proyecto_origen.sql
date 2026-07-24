-- Vincular gastos de obra a proyecto y origen de importación (Lulo MDB/CSV).



alter table public.gastos_obra

  add column if not exists proyecto_id uuid references public.ci_proyectos (id) on delete set null;



alter table public.gastos_obra

  add column if not exists origen text not null default 'manual';



create index if not exists idx_gastos_obra_proyecto_id

  on public.gastos_obra (proyecto_id);



create index if not exists idx_gastos_obra_proyecto_origen

  on public.gastos_obra (proyecto_id, origen);



comment on column public.gastos_obra.proyecto_id is

  'Proyecto módulo asociado (import Lulo u otros).';

comment on column public.gastos_obra.origen is

  'manual | lulo_mdb | lulo_csv | etc.';



notify pgrst, 'reload schema';

