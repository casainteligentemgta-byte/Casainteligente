-- Clientes de administración delegada como entidades, sin duplicar datos.
-- Una entidad puede enlazarse a su cliente (customers). Nombre y RIF se leen del cliente.
-- Gastos propios de la entidad: nueva clasificación 'tecnologia'.

alter table public.ci_entidades
  add column if not exists tipo text not null default 'propia';

alter table public.ci_entidades
  drop constraint if exists ci_entidades_tipo_check;

alter table public.ci_entidades
  add constraint ci_entidades_tipo_check
  check (tipo in ('propia', 'cliente_administrada'));

alter table public.ci_entidades
  add column if not exists customer_id uuid references public.customers (id) on delete set null;

create unique index if not exists ux_ci_entidades_customer_id
  on public.ci_entidades (customer_id)
  where customer_id is not null;

alter table public.ci_entidades
  drop constraint if exists ci_entidades_cliente_requiere_customer_check;

alter table public.ci_entidades
  add constraint ci_entidades_cliente_requiere_customer_check
  check (tipo <> 'cliente_administrada' or customer_id is not null);

comment on column public.ci_entidades.tipo is
  'propia: entidad que carga sus propios gastos (p. ej. Dimaquinas). cliente_administrada: dueño de la obra bajo administración delegada.';
comment on column public.ci_entidades.customer_id is
  'Cliente enlazado (solo cliente_administrada). Nombre y RIF se leen de customers; no se copian.';

-- Clasificación de gastos propios de entidad: se agrega Tecnología.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.contabilidad_compras'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%clasificacion_gasto_entidad%'
  loop
    execute format('alter table public.contabilidad_compras drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.contabilidad_compras
  add constraint contabilidad_compras_clasificacion_gasto_entidad_check
  check (
    clasificacion_gasto_entidad is null
    or clasificacion_gasto_entidad in ('operacional', 'administrativo', 'servicio', 'tecnologia')
  );

notify pgrst, 'reload schema';
