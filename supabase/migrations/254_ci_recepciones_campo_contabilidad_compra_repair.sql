-- Reparar enlace FRM ↔ contabilidad_compras (213) si la columna/FK no está en prod.

alter table public.ci_recepciones_campo
  add column if not exists contabilidad_compra_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_schema = kcu.constraint_schema
     and tc.constraint_name = kcu.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'ci_recepciones_campo'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'contabilidad_compra_id'
  ) then
    alter table public.ci_recepciones_campo
      add constraint ci_recepciones_campo_contabilidad_compra_id_fkey
      foreign key (contabilidad_compra_id)
      references public.contabilidad_compras (id)
      on delete set null;
  end if;
exception
  when others then
    raise notice 'ci_recepciones_campo contabilidad_compra_id FK: %', sqlerrm;
end $$;

create index if not exists idx_ci_recepciones_campo_contabilidad
  on public.ci_recepciones_campo (contabilidad_compra_id)
  where contabilidad_compra_id is not null;

comment on column public.ci_recepciones_campo.contabilidad_compra_id is
  'Compra contable creada al registrar el ingreso en campo (cantidades). Conciliación fiscal actualiza esta fila.';

notify pgrst, 'reload schema';
