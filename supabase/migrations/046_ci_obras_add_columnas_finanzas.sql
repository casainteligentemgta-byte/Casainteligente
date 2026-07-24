-- Reparación: "column ci_obras.presupuesto_mano_obra_ves does not exist"
-- Ocurre cuando existe ci_obras (p. ej. migración 025) pero no se aplicó 035 ni la parte ALTER de 044.

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_tables where schemaname = 'public' and tablename = 'ci_obras'
  ) then
    raise exception 'No existe public.ci_obras. Aplica primero 044_ensure_ci_obras.sql o 025_ci_talento_obras.sql.';
  end if;
end $$;

alter table public.ci_obras add column if not exists presupuesto_ves numeric(14, 2);
alter table public.ci_obras add column if not exists presupuesto_mano_obra_ves numeric(14, 2);
alter table public.ci_obras add column if not exists fondo_reserva_liquidacion_ves numeric(14, 2);

comment on column public.ci_obras.presupuesto_ves is
  'Presupuesto total de referencia del proyecto en bolívares (opcional).';
comment on column public.ci_obras.presupuesto_mano_obra_ves is
  'Presupuesto de mano de obra (VES) frente al cual se mide desviación; si null, puede usarse presupuesto_ves como referencia.';
comment on column public.ci_obras.fondo_reserva_liquidacion_ves is
  'Fondo de reserva para gastos de liquidación / transferencia (referencia Cl. 13 GOE 6.752); alertas si la simulación lo supera.';

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
