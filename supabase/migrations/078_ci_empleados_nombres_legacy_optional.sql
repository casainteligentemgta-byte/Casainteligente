-- Columna legado `nombres` (algunas bases la tienen NOT NULL desde fuera del repo).
-- La app rellena `nombres` en inserts Gaceta/examen; si la columna no existía, queda nullable.
alter table public.ci_empleados
  add column if not exists nombres text;

notify pgrst, 'reload schema';
