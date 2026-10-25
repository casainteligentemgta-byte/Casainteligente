-- El project manager conserva su rol (p. ej. Aprobador para procuras) y además tiene esta marca.
alter table public.ci_usuarios_sistema_telegram
  add column if not exists es_project_manager boolean not null default false;
