-- Asegura FK explícita cronograma_tareas → ci_presupuesto_partidas para PostgREST (embed partida).

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'cronograma_tareas'
  )
  and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ci_presupuesto_partidas'
  ) then
    alter table public.cronograma_tareas
      drop constraint if exists cronograma_tareas_partida_id_fkey;

    alter table public.cronograma_tareas
      add constraint cronograma_tareas_partida_id_fkey
      foreign key (partida_id)
      references public.ci_presupuesto_partidas (id)
      on delete set null;
  end if;
end $$;

comment on constraint cronograma_tareas_partida_id_fkey on public.cronograma_tareas is
  'Vincula tarea Gantt con partida Lulo (ci_presupuesto_partidas).';

notify pgrst, 'reload schema';
