-- Finanzas / Gestor de obras: presupuesto específico de MD y fondo para liquidaciones (contexto Cl. 13 conv.).

alter table public.ci_obras
  add column if not exists presupuesto_mano_obra_ves numeric(14, 2),
  add column if not exists fondo_reserva_liquidacion_ves numeric(14, 2);

comment on column public.ci_obras.presupuesto_mano_obra_ves is
  'Presupuesto de mano de obra (VES) frente al cual se mide desviación; si null, puede usarse presupuesto_ves como referencia.';

comment on column public.ci_obras.fondo_reserva_liquidacion_ves is
  'Fondo de reserva para gastos de liquidación / transferencia (referencia Cl. 13 GOE 6.752); alertas si la simulación lo supera.';
