-- Departamento Legal: enlazar expedientes con clientes del módulo CRM (public.customers).

alter table public.ci_legal_casos
  add column if not exists cliente_id uuid references public.customers (id) on delete set null;

create index if not exists idx_ci_legal_casos_cliente_id
  on public.ci_legal_casos (cliente_id)
  where cliente_id is not null;

comment on column public.ci_legal_casos.cliente_id is
  'Cliente del módulo /clientes (public.customers). cliente_nombre se mantiene como etiqueta denormalizada.';

-- Migrar coincidencias por nombre / razón social (case-insensitive).
update public.ci_legal_casos c
set cliente_id = matched.id
from (
  select distinct on (lower(btrim(c2.cliente_nombre)))
    c2.id as caso_id,
    cust.id
  from public.ci_legal_casos c2
  join public.customers cust
    on (
      lower(btrim(cust.nombre)) = lower(btrim(c2.cliente_nombre))
      or (
        cust.razon_social is not null
        and btrim(cust.razon_social) <> ''
        and lower(btrim(cust.razon_social)) = lower(btrim(c2.cliente_nombre))
      )
    )
  where c2.cliente_id is null
    and c2.cliente_nombre is not null
    and btrim(c2.cliente_nombre) <> ''
  order by lower(btrim(c2.cliente_nombre)), cust.created_at asc nulls last
) matched
where c.id = matched.caso_id
  and c.cliente_id is null;
