-- Permite alertas de permisos personalizados (además de IVSS / INCES / solvencia).

alter table public.ci_permisologia_alertas_log
  drop constraint if exists ci_permisologia_alertas_log_campo_check;

alter table public.ci_permisologia_alertas_log
  add constraint ci_permisologia_alertas_log_campo_check
  check (char_length(trim(campo)) >= 1 and char_length(campo) <= 80);

comment on column public.ci_permisologia_alertas_log.campo is
  'Clave del permiso: ivss_vence / inces_vence / solvencia_laboral_vence o id de ítem personalizado.';

notify pgrst, 'reload schema';
