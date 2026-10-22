-- Rol Project Manager para el bot (menú de carga igual que el administrador).
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.ci_usuarios_sistema_telegram'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%Administrador%';
  if v_constraint is not null then
    execute format('alter table public.ci_usuarios_sistema_telegram drop constraint %I', v_constraint);
  end if;
  alter table public.ci_usuarios_sistema_telegram
    add constraint ci_usuarios_sistema_telegram_rol_check
    check (rol = any (array['Solicitante'::text, 'Aprobador'::text, 'Comprador'::text,
                            'Administrador'::text, 'Contador'::text, 'Project Manager'::text]));
end $$;
