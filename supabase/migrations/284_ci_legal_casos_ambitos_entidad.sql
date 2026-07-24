-- Departamento Legal: ámbitos por entidad + despacho/abogado en caso externo.

alter table public.ci_legal_casos
  add column if not exists despacho_abogado text;

comment on column public.ci_legal_casos.despacho_abogado is
  'Nombre del despacho o abogado cuando el ámbito es caso externo.';

-- Soltar el check ANTES de migrar valores (el legado solo permitía obra/despacho/externo).
alter table public.ci_legal_casos
  drop constraint if exists ci_legal_casos_ambito_check;

-- Migrar legado "obra" → entidad Casa Inteligente
update public.ci_legal_casos
set ambito = 'casa_inteligente'
where ambito = 'obra';

alter table public.ci_legal_casos
  add constraint ci_legal_casos_ambito_check
  check (ambito in (
    'casa_inteligente',
    'dimaquinas',
    'despacho',
    'externo'
  ));

comment on column public.ci_legal_casos.ambito is
  'Entidad / ámbito: casa_inteligente, dimaquinas, despacho (general) o externo (caso externo).';
