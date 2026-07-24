-- Campos opcionales para el PDF estructurado del contrato obrero (cláusulas segunda y tercera, cierre de firma).

alter table public.ci_contratos_empleado_obra
  add column if not exists duracion_referencial_semanas text,
  add column if not exists horario_semanal_texto text,
  add column if not exists fecha_firma_contrato date;

comment on column public.ci_contratos_empleado_obra.duracion_referencial_semanas is
  'Duración referencial (p. ej. «12 semanas») para la cláusula segunda del contrato PDF.';
comment on column public.ci_contratos_empleado_obra.horario_semanal_texto is
  'Horario semanal acordado (p. ej. «7:00 a.m. a 4:00 p.m.») para la cláusula tercera.';
comment on column public.ci_contratos_empleado_obra.fecha_firma_contrato is
  'Fecha de firma de ejemplares; si es null, el PDF puede usar fecha_ingreso.';

notify pgrst, 'reload schema';
