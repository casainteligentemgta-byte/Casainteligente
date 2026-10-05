-- La tabla de respaldo del historial de migraciones quedó sin RLS y con
-- permisos para cualquiera con la clave pública (leer el SQL de las
-- migraciones, modificarlo o borrarlo). La app no la usa: se cierra del todo.
-- Los datos no se tocan; el acceso de administración (service_role) sigue igual.
do $$
begin
  if to_regclass('public._schema_migrations_backup_20261003') is not null then
    alter table public._schema_migrations_backup_20261003 enable row level security;
    revoke all on public._schema_migrations_backup_20261003 from anon, authenticated;
    comment on table public._schema_migrations_backup_20261003 is
      'Respaldo del historial de migraciones (2026-10-03). Solo administración: sin acceso desde la app.';
  end if;
end $$;
