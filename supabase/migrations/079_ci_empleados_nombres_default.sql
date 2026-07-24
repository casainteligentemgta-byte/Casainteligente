-- nombres NOT NULL sin DEFAULT: si la API omite la columna, Postgres intenta NULL.
-- Rellena filas existentes, aplica DEFAULT y NOT NULL, recarga PostgREST.

alter table public.ci_empleados
  add column if not exists nombres text;

update public.ci_empleados
set nombres = left(
  case
    when btrim(coalesce(nombres, '')) <> '' then btrim(nombres)
    when position(',' in coalesce(nombre_completo, '')) > 0 then btrim(split_part(nombre_completo, ',', 2))
    else btrim(coalesce(nombre_completo, ''))
  end,
  500
)
where nombres is null or btrim(coalesce(nombres, '')) = '';

update public.ci_empleados
set nombres = 'Postulante'
where nombres is null or btrim(coalesce(nombres, '')) = '';

alter table public.ci_empleados
  alter column nombres set default 'Postulante';

alter table public.ci_empleados
  alter column nombres set not null;

notify pgrst, 'reload schema';
