-- Campos adicionales en ci_entidades para autocompletar documentos legales

alter table public.ci_entidades
  add column if not exists domicilio text,
  add column if not exists registro_mercantil text,
  add column if not exists representante_legal text,
  add column if not exists representante_cedula text,
  add column if not exists representante_estado_civil text,
  add column if not exists representante_profesion text;

notify pgrst, 'reload schema';
