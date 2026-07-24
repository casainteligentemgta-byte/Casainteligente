-- Anti-duplicados CCO al reimportar CSV/JSON V4.
-- 1) Ingresos: UNIQUE por referencia V4-{origen_v4_id}
-- 2) Auditoría de clase: UNIQUE por origen_v4_id
-- 3) Limpia duplicados previos y backfill de referencias

-- Dedup ingresos CCO ya duplicados (mismo proyecto + mismo id V4 en origen_fondo)
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

-- Backfill referencia V4-{id} desde origen_fondo
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

comment on index public.uq_ci_inyecciones_ref_v4 is
  'Impide duplicar ingresos CCO al reimportar: referencia_bancaria = V4-{origen_v4_id}.';

-- Dedup auditoría de clase V4 (conserva la más antigua)
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

comment on index public.uq_cco_auditoria_origen_v4 is
  'Eventos CLASE=AUDITORIA del maestro V4. Eventos de import (sin origen_v4_id) no se ven afectados.';

notify pgrst, 'reload schema';
