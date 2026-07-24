-- Departamento Legal: ramas Tributario/Corporativo + códigos de expediente EXP-YYYY-XXX.

-- 1) Ampliar categorías de conocimiento RAG
alter table public.ci_legal_knowledge
  drop constraint if exists ci_legal_knowledge_categoria_check;

alter table public.ci_legal_knowledge
  add constraint ci_legal_knowledge_categoria_check
  check (categoria in (
    'laboral',
    'civil',
    'internacional',
    'mercantil',
    'tributario',
    'corporativo'
  ));

-- 2) Ampliar tipos de expediente / caso
alter table public.ci_legal_casos
  drop constraint if exists ci_legal_casos_tipo_check;

alter table public.ci_legal_casos
  add constraint ci_legal_casos_tipo_check
  check (tipo in (
    'obra_contrato',
    'obra_reclamo',
    'laboral',
    'proveedor',
    'civil',
    'mercantil',
    'tributario',
    'corporativo',
    'administrativo',
    'externo',
    'otro'
  ));

-- 3) Código único por organización (EXP-YYYY-XXX)
create unique index if not exists idx_ci_legal_casos_org_codigo
  on public.ci_legal_casos (org_id, codigo)
  where codigo is not null and btrim(codigo) <> '';

comment on column public.ci_legal_casos.codigo is
  'Código único de expediente por org: EXP-YYYY-XXX (America/Caracas).';

create or replace function public.ci_legal_siguiente_codigo_expediente(p_org_id uuid)
returns text
language plpgsql
as $$
declare
  v_year text;
  v_prefix text;
  v_max int;
  v_next int;
begin
  if p_org_id is null then
    raise exception 'org_id requerido';
  end if;

  v_year := to_char((timezone('America/Caracas', now()))::date, 'YYYY');
  v_prefix := 'EXP-' || v_year || '-';

  select coalesce(
    max(
      nullif(
        regexp_replace(c.codigo, '^EXP-' || v_year || '-0*', ''),
        ''
      )::int
    ),
    0
  )
  into v_max
  from public.ci_legal_casos c
  where c.org_id = p_org_id
    and c.codigo ~ ('^EXP-' || v_year || '-[0-9]+$');

  v_next := v_max + 1;
  return v_prefix || lpad(v_next::text, greatest(3, length(v_next::text)), '0');
end;
$$;

comment on function public.ci_legal_siguiente_codigo_expediente(uuid) is
  'Genera el siguiente código de expediente EXP-YYYY-XXX para un org Legal.';

revoke all on function public.ci_legal_siguiente_codigo_expediente(uuid) from public;
grant execute on function public.ci_legal_siguiente_codigo_expediente(uuid) to authenticated;
grant execute on function public.ci_legal_siguiente_codigo_expediente(uuid) to service_role;

-- 4) Backfill de códigos faltantes (por org, orden de creación)
do $$
declare
  r record;
  v_codigo text;
begin
  for r in
    select id, org_id
    from public.ci_legal_casos
    where codigo is null or btrim(codigo) = ''
    order by org_id, created_at asc, id asc
  loop
    v_codigo := public.ci_legal_siguiente_codigo_expediente(r.org_id);
    update public.ci_legal_casos
      set codigo = v_codigo,
          updated_at = now()
    where id = r.id;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
