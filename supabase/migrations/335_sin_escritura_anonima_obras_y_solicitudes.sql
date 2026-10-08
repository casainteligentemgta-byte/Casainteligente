-- Sin sesión solo se puede LEER obras y solicitudes de personal (lo que usa el enlace público).
-- Pendiente: ejecutar en el SQL Editor de Supabase (desde aquí la aplicación fue cancelada).
drop policy if exists recruitment_needs_insert_anon on public.recruitment_needs;
drop policy if exists recruitment_needs_update_anon on public.recruitment_needs;
drop policy if exists recruitment_needs_delete_anon on public.recruitment_needs;
drop policy if exists ci_proyectos_insert_anon on public.ci_proyectos;
drop policy if exists ci_proyectos_update_anon on public.ci_proyectos;
drop policy if exists ci_proyectos_delete_anon on public.ci_proyectos;
revoke insert, update, delete on public.recruitment_needs from anon;
revoke insert, update, delete on public.ci_proyectos from anon;
