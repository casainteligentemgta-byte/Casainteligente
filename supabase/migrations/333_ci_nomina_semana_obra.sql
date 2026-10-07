-- Nómina semanal de obra: dos caras de recibo (legal / patio) y adelanto de
-- prestaciones cada 4 semanas trabajadas (art. 144 LOTTT).
-- Tarifas de patio: ayudante USD 90 y clasificado USD 117 (cesta incluida).
--
-- Las tablas llevan «obra» en el nombre porque en la base ya existían
-- `ci_nomina_periodos`, `ci_nomina_recibos`, `ci_nomina_conceptos` y
-- `ci_nomina_lineas` de un diseño anterior (vacías, con otras columnas);
-- con el mismo nombre, `create table if not exists` no creaba nada y guardar fallaba.

create table if not exists public.ci_nomina_obra_periodos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  semana_inicio date not null,
  semana_fin date not null,
  tasa_bcv_pago numeric(18, 6) not null check (tasa_bcv_pago > 0),
  tasa_ancla_cesta_bcv numeric(18, 6) not null check (tasa_ancla_cesta_bcv > 0),
  estado text not null default 'abierto' check (estado in ('abierto', 'pagado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, semana_inicio)
);

comment on table public.ci_nomina_obra_periodos is
  'Semana de nómina de obra (pago viernes). Un periodo por proyecto y lunes de semana.';

create table if not exists public.ci_nomina_obra_items (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references public.ci_nomina_obra_periodos (id) on delete cascade,
  empleado_id uuid not null references public.ci_empleados (id) on delete cascade,
  tipo text not null check (tipo in ('semanal', 'adelanto_prestaciones')),
  clase text not null check (clase in ('ayudante', 'clasificado')),
  oficio_codigo text not null,
  oficio_denominacion text not null,
  oficio_nivel smallint not null,
  diario_ves numeric(14, 2) not null,
  dias_laborados smallint not null default 0 check (dias_laborados >= 0 and dias_laborados <= 5),
  dias_pagados smallint not null default 0 check (dias_pagados >= 0 and dias_pagados <= 7),
  sobre_usd numeric(12, 2) not null,
  salario_basico_ves numeric(16, 2) not null default 0,
  cesta_usd numeric(12, 4) not null default 0,
  cesta_ves numeric(16, 2) not null default 0,
  complemento_usd numeric(12, 4) not null default 0,
  total_usd numeric(12, 4) not null,
  total_ves numeric(16, 2) not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (periodo_id, empleado_id, tipo)
);

comment on table public.ci_nomina_obra_items is
  'Ítem de recibo: semanal (90/117 con cesta adentro) o adelanto de prestaciones (quinta semana).';

create index if not exists idx_ci_nomina_obra_items_empleado
  on public.ci_nomina_obra_items (empleado_id, created_at desc);

create table if not exists public.ci_prestaciones_saldo (
  empleado_id uuid not null references public.ci_empleados (id) on delete cascade,
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  acumulado_ves numeric(16, 2) not null default 0,
  adelantado_ves numeric(16, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (empleado_id, proyecto_id)
);

comment on table public.ci_prestaciones_saldo is
  'Saldo de garantía de prestaciones (Cl. 50) por obrero y obra, menos adelantos art. 144.';

create table if not exists public.ci_nomina_obra_adelantos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.ci_nomina_obra_items (id) on delete cascade,
  empleado_id uuid not null references public.ci_empleados (id) on delete cascade,
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  solicitado_at timestamptz not null default now(),
  solicitud_texto text not null,
  firmante_nombre text,
  firmado_at timestamptz,
  monto_usd numeric(12, 4) not null,
  monto_ves numeric(16, 2) not null,
  garantia_ves numeric(16, 2) not null default 0
);

comment on table public.ci_nomina_obra_adelantos is
  'Solicitud escrita y constancia de adelanto de prestaciones (art. 144 LOTTT) cada 4 semanas.';

create or replace function public.actualizar_updated_at_ci_nomina_obra_periodos()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_ci_nomina_obra_periodos_updated on public.ci_nomina_obra_periodos;
create trigger tr_ci_nomina_obra_periodos_updated
  before update on public.ci_nomina_obra_periodos
  for each row execute function public.actualizar_updated_at_ci_nomina_obra_periodos();

alter table public.ci_nomina_obra_periodos enable row level security;
alter table public.ci_nomina_obra_items enable row level security;
alter table public.ci_prestaciones_saldo enable row level security;
alter table public.ci_nomina_obra_adelantos enable row level security;

drop policy if exists "ci_nomina_obra_periodos_all_auth" on public.ci_nomina_obra_periodos;
drop policy if exists "ci_nomina_obra_items_all_auth" on public.ci_nomina_obra_items;
drop policy if exists "ci_prestaciones_saldo_all_auth" on public.ci_prestaciones_saldo;
drop policy if exists "ci_nomina_obra_adelantos_all_auth" on public.ci_nomina_obra_adelantos;

create policy "ci_nomina_obra_periodos_all_auth" on public.ci_nomina_obra_periodos
  for all to authenticated using (true) with check (true);
create policy "ci_nomina_obra_items_all_auth" on public.ci_nomina_obra_items
  for all to authenticated using (true) with check (true);
create policy "ci_prestaciones_saldo_all_auth" on public.ci_prestaciones_saldo
  for all to authenticated using (true) with check (true);
create policy "ci_nomina_obra_adelantos_all_auth" on public.ci_nomina_obra_adelantos
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.ci_nomina_obra_periodos to authenticated, service_role;
grant select, insert, update, delete on public.ci_nomina_obra_items to authenticated, service_role;
grant select, insert, update, delete on public.ci_prestaciones_saldo to authenticated, service_role;
grant select, insert, update, delete on public.ci_nomina_obra_adelantos to authenticated, service_role;

-- Datos de nómina: sin acceso para visitantes sin sesión, ni siquiera por permisos de tabla.
revoke all on public.ci_nomina_obra_periodos from anon;
revoke all on public.ci_nomina_obra_items from anon;
revoke all on public.ci_prestaciones_saldo from anon;
revoke all on public.ci_nomina_obra_adelantos from anon;

notify pgrst, 'reload schema';
