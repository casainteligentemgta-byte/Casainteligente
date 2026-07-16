-- Asegura columnas de obra/proyecto usadas por contratos PDF y express (por si la migración 086 no se aplicó en el entorno).
alter table public.ci_proyectos add column if not exists obra_ubicacion text;

comment on column public.ci_proyectos.obra_ubicacion is
  'Ubicación de la obra (Talento); alineado con migración 086_ci_proyectos_unifica_ci_obras.sql.';

notify pgrst, 'reload schema';
