-- Vacantes con «examen primero»: el enlace de captación pide datos básicos,
-- luego la evaluación, y solo si no sale en rojo abre la hoja de vida completa.
-- Por defecto false: las vacantes existentes siguen con hoja de vida → evaluación.

alter table public.recruitment_needs
  add column if not exists examen_primero boolean not null default false;

comment on column public.recruitment_needs.examen_primero is
  'Si es true, /registro/[token] pide datos básicos → evaluación → hoja de vida (solo si el semáforo no es rojo).';
