-- Un usuario del bot puede tener un rol principal y roles adicionales (p. ej. Aprobador + Project Manager).
alter table public.ci_usuarios_sistema_telegram
  add column if not exists roles_adicionales text[] not null default '{}';

-- Carla Di Matteo (Dimaquinas): Aprobador + Project Manager
update public.ci_usuarios_sistema_telegram
set roles_adicionales = array['Project Manager']::text[], updated_at = now()
where telegram_id = 7971122319;
