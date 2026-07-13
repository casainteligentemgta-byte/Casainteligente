-- Acceso de empleados: Auth + roles de administración
-- Ejecutar en Supabase → SQL Editor

-- Vincular ficha de empleado con usuario Auth
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS acceso_habilitado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id
  ON public.employees (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_employees_email_lower
  ON public.employees ((lower(email)));

-- Roles de acceso web (admin dueño / general / contable / empleado)
CREATE TABLE IF NOT EXISTS public.ci_roles_acceso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rol TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ci_roles_acceso_user_rol_unique UNIQUE (user_id, rol)
);

COMMENT ON TABLE public.ci_roles_acceso IS
  'Roles de acceso: admin_dueno, admin_general, admin_contable, empleado, etc.';

CREATE INDEX IF NOT EXISTS idx_ci_roles_acceso_user
  ON public.ci_roles_acceso (user_id);

ALTER TABLE public.ci_roles_acceso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ci_roles_acceso_select_auth" ON public.ci_roles_acceso;
CREATE POLICY "ci_roles_acceso_select_auth" ON public.ci_roles_acceso
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ci_roles_acceso_write_auth" ON public.ci_roles_acceso;
CREATE POLICY "ci_roles_acceso_write_auth" ON public.ci_roles_acceso
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ejemplo: otorgar rol a un admin dueño (reemplaza el UUID)
-- INSERT INTO public.ci_roles_acceso (user_id, rol)
-- VALUES ('UUID-DEL-USUARIO-AUTH', 'admin_dueno')
-- ON CONFLICT (user_id, rol) DO NOTHING;
