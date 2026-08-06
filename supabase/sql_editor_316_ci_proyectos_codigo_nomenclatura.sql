-- 316 (SQL Editor): Código de nomenclatura del proyecto para contratos / documentos.
-- Ejecutar en Supabase SQL Editor si la migración CLI no se aplicó.

alter table public.ci_proyectos
  add column if not exists codigo_nomenclatura text;

comment on column public.ci_proyectos.codigo_nomenclatura is
  'Código corto para nomenclatura de contratos y documentos (ej. ASFJG). Preferido sobre obra_codigo.';

create unique index if not exists idx_ci_proyectos_codigo_nomenclatura_unique
  on public.ci_proyectos (codigo_nomenclatura)
  where codigo_nomenclatura is not null and length(trim(codigo_nomenclatura)) > 0;

update public.ci_proyectos p
set codigo_nomenclatura = upper(regexp_replace(trim(p.obra_codigo), '[^A-Za-z0-9]', '', 'g'))
where (p.codigo_nomenclatura is null or trim(p.codigo_nomenclatura) = '')
  and p.obra_codigo is not null
  and length(trim(p.obra_codigo)) > 0
  and length(regexp_replace(trim(p.obra_codigo), '[^A-Za-z0-9]', '', 'g')) between 2 and 16;

notify pgrst, 'reload schema';
