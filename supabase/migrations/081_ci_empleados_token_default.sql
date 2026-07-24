-- Columna legado `token` NOT NULL (convive con `token_registro` de onboarding).
alter table public.ci_empleados
  add column if not exists token text;

update public.ci_empleados e
set token = e.token_registro
where btrim(coalesce(e.token_registro, '')) <> ''
  and (e.token is null or btrim(coalesce(e.token, '')) = '');

update public.ci_empleados
set token = gen_random_uuid()::text
where token is null or btrim(coalesce(token, '')) = '';

alter table public.ci_empleados
  alter column token set default (gen_random_uuid()::text);

alter table public.ci_empleados
  alter column token set not null;

notify pgrst, 'reload schema';
