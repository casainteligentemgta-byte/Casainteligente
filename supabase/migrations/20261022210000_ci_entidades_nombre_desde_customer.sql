-- Las entidades cliente_administrada no repiten el nombre: se lee de customers.nombre.
-- ci_entidades.nombre queda nullable, pero obligatorio cuando la entidad no está enlazada a un cliente.
alter table public.ci_entidades alter column nombre drop not null;

alter table public.ci_entidades
  drop constraint if exists ci_entidades_nombre_requerido_check;

alter table public.ci_entidades
  add constraint ci_entidades_nombre_requerido_check
  check (customer_id is not null or (nombre is not null and btrim(nombre) <> ''));
