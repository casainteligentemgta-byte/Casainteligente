-- Acceso web de empleados (CRM `employees`) ↔ Supabase Auth
-- Preferir invite por correo; clave aleatoria solo como fallback de un solo uso.
-- Roles de app: reutilizar `ci_usuarios_roles` (no crear tabla paralela).

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS acceso_habilitado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id
  ON public.employees (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_employees_email_lower
  ON public.employees ((lower(email)));

COMMENT ON COLUMN public.employees.auth_user_id IS
  'Usuario Supabase Auth vinculado a esta ficha CRM';
COMMENT ON COLUMN public.employees.acceso_habilitado IS
  'Si true, el empleado tiene acceso web habilitado desde RRHH/Equipo';

NOTIFY pgrst, 'reload schema';
