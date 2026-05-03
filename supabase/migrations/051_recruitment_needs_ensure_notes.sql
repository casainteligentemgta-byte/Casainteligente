-- Proyectos remotos sin migración 031 completa o caché PostgREST desactualizada (PGRST204 en `notes`).

alter table public.recruitment_needs
  add column if not exists notes text;

notify pgrst, 'reload schema';
