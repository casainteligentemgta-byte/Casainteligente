-- Trípode de evaluación: GMA 0–5, riesgo integridad 0–10, tiempo, motivo.

alter table public.ci_empleados
  add column if not exists gma_0_5 smallint check (gma_0_5 is null or (gma_0_5 >= 0 and gma_0_5 <= 5));

alter table public.ci_empleados
  add column if not exists nivel_integridad_riesgo numeric(4,2);

alter table public.ci_empleados
  add column if not exists completo_en_tiempo boolean;

alter table public.ci_empleados
  add column if not exists motivo_semaforo text;

alter table public.ci_empleados
  add column if not exists color_disc text;

comment on column public.ci_empleados.nivel_integridad_riesgo is '0–10: mayor = más riesgo ético/operativo (menor integridad percibida).';
comment on column public.ci_empleados.gma_0_5 is 'Aciertos lógicos de 5 (GMA).';
