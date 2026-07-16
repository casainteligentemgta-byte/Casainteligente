-- Contrato obra: campos LOTTT / Gaceta (ingreso manual RRHH, cargo desde vacante, SB tabulador, etc.).

alter table public.ci_contratos_empleado_obra
  add column if not exists fecha_ingreso date,
  add column if not exists recruitment_need_id uuid references public.recruitment_needs (id) on delete set null,
  add column if not exists cargo_oficio_desempeño text,
  add column if not exists tabulador_nivel smallint,
  add column if not exists salario_basico_diario_ves numeric(14, 4),
  add column if not exists forma_pago text,
  add column if not exists lugar_pago text,
  add column if not exists jornada_trabajo text,
  add column if not exists lugar_prestacion_servicio text,
  add column if not exists tipo_contrato text,
  add column if not exists objeto_contrato text,
  add column if not exists numero_oficio_tabulador text,
  add column if not exists gaceta_denominacion_oficio text;

comment on column public.ci_contratos_empleado_obra.fecha_ingreso is
  'Fecha de ingreso al trabajo; la define manualmente admin / jefe de RRHH.';
comment on column public.ci_contratos_empleado_obra.recruitment_need_id is
  'Vacante origen (precarga cargo/oficio desde solicitud de obrero).';
comment on column public.ci_contratos_empleado_obra.cargo_oficio_desempeño is
  'Cargo u oficio a desempeñar (típicamente precargado desde recruitment_needs / ci_empleados).';
comment on column public.ci_contratos_empleado_obra.salario_basico_diario_ves is
  'Salario básico diario VES según tabulador anexo (nivel 1–9).';
comment on column public.ci_contratos_empleado_obra.forma_pago is
  'transferencia | efectivo | pago_movil (+ detalle opcional en lugar_pago).';
comment on column public.ci_contratos_empleado_obra.jornada_trabajo is
  'diurna | nocturna | mixta.';
comment on column public.ci_contratos_empleado_obra.lugar_prestacion_servicio is
  'Lugar de prestación (obra/proyecto seleccionado).';
comment on column public.ci_contratos_empleado_obra.tipo_contrato is
  'tiempo_determinado | tiempo_indeterminado.';
comment on column public.ci_contratos_empleado_obra.numero_oficio_tabulador is
  'Código de oficio en tabulador Gaceta (ej. 5.1, 3.22).';

notify pgrst, 'reload schema';
