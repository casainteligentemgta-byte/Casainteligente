-- Amplía numeric(15,2) → numeric(18,2) para importaciones Lulo con totales grandes.
-- Si hay vistas sobre monto_total_estimado, se eliminan con CASCADE (recrear manualmente si aplica).

do $$
declare
  r record;
begin
  for r in
    select distinct n.nspname as schema_name, v.relname as view_name
    from pg_class t
    join pg_attribute a on a.attrelid = t.oid and not a.attisdropped
    join pg_depend d on d.refobjid = t.oid and d.refobjsubid = a.attnum
    join pg_rewrite rw on rw.oid = d.objid
    join pg_class v on v.oid = rw.ev_class and v.relkind = 'v'
    join pg_namespace n on n.oid = v.relnamespace
    where t.relname = 'ci_presupuesto_partidas'
      and a.attname = 'monto_total_estimado'
      and n.nspname = 'public'
  loop
    execute format('drop view if exists %I.%I cascade', r.schema_name, r.view_name);
    raise notice 'Vista dependiente eliminada: %.%.', r.schema_name, r.view_name;
  end loop;
end $$;

alter table public.ci_presupuesto_partidas
  alter column monto_total_estimado type numeric(18, 2)
  using least(greatest(monto_total_estimado::numeric, -9999999999999999.99), 9999999999999999.99);

alter table public.gastos_obra
  alter column costo type numeric(18, 2)
  using least(greatest(costo::numeric, -9999999999999999.99), 9999999999999999.99);

notify pgrst, 'reload schema';
