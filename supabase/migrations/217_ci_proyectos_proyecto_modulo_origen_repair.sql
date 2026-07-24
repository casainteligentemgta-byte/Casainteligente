-- Reparación: entornos sin migración 103 (columna proyecto_modulo_origen_id en ci_proyectos).

alter table public.ci_proyectos
  add column if not exists proyecto_modulo_origen_id uuid references public.ci_proyectos (id) on delete set null;

create index if not exists idx_ci_proyectos_modulo_origen
  on public.ci_proyectos (proyecto_modulo_origen_id)
  where proyecto_modulo_origen_id is not null;

comment on column public.ci_proyectos.proyecto_modulo_origen_id is
  'Si la fila es tipo Talento (obra), UUID del proyecto módulo integral desde el que se abrió /proyectos/nuevo. Permite listar recruitment_needs de la obra en la ficha del módulo.';

notify pgrst, 'reload schema';
