-- Correlativo de presupuestos empezando en 500
-- Se usa para mostrar Nro: P-500, P-501, ...

begin;

-- Secuencia base (si ya existía por algún deploy parcial, no falla)
create sequence if not exists public.budgets_correlativo_seq
  start with 500
  increment by 1;

-- Nueva columna (nullable por seguridad al cargar datos existentes)
alter table public.budgets
  add column if not exists numero_correlativo bigint;

-- Asignar correlativo a filas existentes que tengan NULL
with ordered as (
  select
    id,
    row_number() over (order by created_at asc, id asc) as rn
  from public.budgets
)
update public.budgets b
set numero_correlativo = 499 + o.rn
from ordered o
where b.id = o.id
  and b.numero_correlativo is null;

-- Garantizar integridad para el futuro
alter table public.budgets
  alter column numero_correlativo set not null;

alter table public.budgets
  alter column numero_correlativo set default nextval('public.budgets_correlativo_seq');

-- Ajustar la secuencia al máximo existente para mantener correlatividad
select setval(
  'public.budgets_correlativo_seq',
  (select coalesce(max(numero_correlativo), 499) from public.budgets)
);

-- (Opcional) índice único por si quieres evitar duplicados accidentalmente
create unique index if not exists idx_budgets_numero_correlativo_unique
  on public.budgets (numero_correlativo);

commit;

