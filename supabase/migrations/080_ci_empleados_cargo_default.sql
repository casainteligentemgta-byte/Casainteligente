-- Columna legado `cargo` NOT NULL en algunas bases (convive con cargo_nombre / rol_buscado).
alter table public.ci_empleados
  add column if not exists cargo text;

update public.ci_empleados
set cargo = left(
  btrim(coalesce(nullif(btrim(cargo), ''), nullif(btrim(rol_buscado), ''), 'Por definir')),
  500
)
where cargo is null or btrim(coalesce(cargo, '')) = '';

update public.ci_empleados
set cargo = 'Por definir'
where cargo is null or btrim(coalesce(cargo, '')) = '';

alter table public.ci_empleados
  alter column cargo set default 'Por definir';

alter table public.ci_empleados
  alter column cargo set not null;

notify pgrst, 'reload schema';
