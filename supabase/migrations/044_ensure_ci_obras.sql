-- Reparación: PostgREST "Could not find the table 'public.ci_obras' in the schema cache".
-- Origen: migración 025 (y 034/035 para columnas extra) no aplicada en el proyecto remoto.
-- Idempotente: CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + políticas con DROP previo.

create table if not exists public.ci_obras (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  ubicacion text,
  cliente text,
  fecha_inicio date,
  fecha_entrega_prometida date not null,
  avance_porcentaje numeric(5, 2) not null default 0 check (avance_porcentaje >= 0 and avance_porcentaje <= 100),
  precio_venta_usd numeric(14, 2),
  penalizacion_diaria_usd numeric(14, 2) not null default 0,
  estado text not null default 'activa' check (estado in ('activa', 'cerrada')),
  fecha_cierre timestamptz,
  notas text,
  presupuesto_ves numeric(14, 2),
  presupuesto_mano_obra_ves numeric(14, 2),
  fondo_reserva_liquidacion_ves numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Si la tabla ya existía solo con el esquema 025, añade columnas de 034/035.
alter table public.ci_obras add column if not exists presupuesto_ves numeric(14, 2);
alter table public.ci_obras add column if not exists presupuesto_mano_obra_ves numeric(14, 2);
alter table public.ci_obras add column if not exists fondo_reserva_liquidacion_ves numeric(14, 2);

comment on column public.ci_obras.presupuesto_ves is
  'Presupuesto total de referencia del proyecto en bolívares (opcional).';
comment on column public.ci_obras.presupuesto_mano_obra_ves is
  'Presupuesto de mano de obra (VES) frente al cual se mide desviación; si null, puede usarse presupuesto_ves como referencia.';
comment on column public.ci_obras.fondo_reserva_liquidacion_ves is
  'Fondo de reserva para gastos de liquidación / transferencia (referencia Cl. 13 GOE 6.752); alertas si la simulación lo supera.';

create index if not exists idx_ci_obras_estado on public.ci_obras (estado);

alter table public.ci_obras enable row level security;

drop policy if exists "ci_obras_select_anon" on public.ci_obras;
drop policy if exists "ci_obras_insert_anon" on public.ci_obras;
drop policy if exists "ci_obras_update_anon" on public.ci_obras;
drop policy if exists "ci_obras_delete_anon" on public.ci_obras;
drop policy if exists "ci_obras_select_auth" on public.ci_obras;
drop policy if exists "ci_obras_insert_auth" on public.ci_obras;
drop policy if exists "ci_obras_update_auth" on public.ci_obras;
drop policy if exists "ci_obras_delete_auth" on public.ci_obras;

create policy "ci_obras_select_anon" on public.ci_obras for select to anon using (true);
create policy "ci_obras_insert_anon" on public.ci_obras for insert to anon with check (true);
create policy "ci_obras_update_anon" on public.ci_obras for update to anon using (true) with check (true);
create policy "ci_obras_delete_anon" on public.ci_obras for delete to anon using (true);
create policy "ci_obras_select_auth" on public.ci_obras for select to authenticated using (true);
create policy "ci_obras_insert_auth" on public.ci_obras for insert to authenticated with check (true);
create policy "ci_obras_update_auth" on public.ci_obras for update to authenticated using (true) with check (true);
create policy "ci_obras_delete_auth" on public.ci_obras for delete to authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.ci_obras to anon, authenticated, service_role;

notify pgrst, 'reload schema';
