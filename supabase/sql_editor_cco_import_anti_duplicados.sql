-- Pegar en Supabase SQL Editor (producción).
-- Equivalente a: supabase/migrations/276_cco_import_anti_duplicados.sql

with parsed as (
  select
    id,
    proyecto_id,
    creado_al,
    'V4-' || (regexp_match(origen_fondo, '^CCO-V4 #(\d+)'))[1] as ref_v4
  from public.ci_inyecciones_capital
  where creado_por = 'cco_v4_import'
    and origen_fondo ~ '^CCO-V4 #\d+'
),
ranked as (
  select
    id,
    row_number() over (
      partition by proyecto_id, ref_v4
      order by creado_al asc nulls last, id asc
    ) as rn
  from parsed
  where ref_v4 is not null
)
delete from public.ci_inyecciones_capital c
using ranked r
where c.id = r.id
  and r.rn > 1;

update public.ci_inyecciones_capital
set referencia_bancaria = 'V4-' || (regexp_match(origen_fondo, '^CCO-V4 #(\d+)'))[1]
where creado_por = 'cco_v4_import'
  and origen_fondo ~ '^CCO-V4 #\d+'
  and (
    referencia_bancaria is null
    or btrim(referencia_bancaria) = ''
    or referencia_bancaria is distinct from ('V4-' || (regexp_match(origen_fondo, '^CCO-V4 #(\d+)'))[1])
  );

create unique index if not exists uq_ci_inyecciones_ref_v4
  on public.ci_inyecciones_capital (proyecto_id, referencia_bancaria)
  where proyecto_id is not null
    and referencia_bancaria is not null
    and referencia_bancaria like 'V4-%';

with ranked as (
  select
    id,
    row_number() over (
      partition by proyecto_id, origen_v4_id
      order by created_at asc nulls last, id asc
    ) as rn
  from public.cco_auditoria_eventos
  where proyecto_id is not null
    and origen_v4_id is not null
)
delete from public.cco_auditoria_eventos a
using ranked r
where a.id = r.id
  and r.rn > 1;

create unique index if not exists uq_cco_auditoria_origen_v4
  on public.cco_auditoria_eventos (proyecto_id, origen_v4_id)
  where proyecto_id is not null
    and origen_v4_id is not null;

notify pgrst, 'reload schema';
