-- Psique fusionado con reclutamiento: guarda la batería/rol sugeridos al crear candidato.

alter table public.ci_empleados
  add column if not exists psique_recomendacion jsonb null;

comment on column public.ci_empleados.psique_recomendacion is
  'Snapshot Psique al invitar/captar: { palabras_clave, pruebas, rol_examen_sugerido, motor_semaforo, libro, fuente, at }.';

create index if not exists idx_ci_empleados_psique_recomendacion_gin
  on public.ci_empleados using gin (psique_recomendacion)
  where psique_recomendacion is not null;

notify pgrst, 'reload schema';
