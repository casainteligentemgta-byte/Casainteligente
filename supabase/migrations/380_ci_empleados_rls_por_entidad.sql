-- ci_empleados: aislamiento por entidad, mismo modelo que ci_proyectos / migración 374.
--
-- Antes (376): cualquier usuario con equipo.gestionar leía, creaba, editaba y borraba
-- TODAS las filas, de cualquier entidad.
--
-- Ahora: super_admin ve todo. El resto solo opera sobre trabajadores de una entidad
-- en la que su rol tenga equipo.gestionar (pm_obra, rrhh, director, entidad_admin, …).
-- Las políticas anónimas de invitación por token no se tocan.
-- Telegram y rutas API con service_role siguen sin RLS (relforcerowsecurity = false).

CREATE OR REPLACE FUNCTION public.ci_tiene_permiso_en_entidad(p_permiso text, p_entidad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ci_usuarios_roles ur
    JOIN public.ci_rol_permisos rp ON rp.rol = ur.rol
    WHERE ur.user_id = auth.uid()
      AND rp.permiso = p_permiso
      AND (
        ur.rol = 'super_admin'::public.ci_rol_sistema
        OR ur.entidad_id = p_entidad_id
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.ci_tiene_permiso_en_entidad(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ci_tiene_permiso_en_entidad(text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.ci_tiene_permiso_en_entidad(text, uuid) IS
  'SECURITY DEFINER: permiso de empresa en una entidad, o super_admin global. Para RLS.';

DROP POLICY IF EXISTS ci_empleados_select_equipo ON public.ci_empleados;
DROP POLICY IF EXISTS ci_empleados_insert_equipo ON public.ci_empleados;
DROP POLICY IF EXISTS ci_empleados_update_equipo ON public.ci_empleados;
DROP POLICY IF EXISTS ci_empleados_delete_equipo ON public.ci_empleados;

CREATE POLICY ci_empleados_select_equipo ON public.ci_empleados
  FOR SELECT TO authenticated
  USING (public.ci_tiene_permiso_en_entidad('equipo.gestionar', entidad_id));

CREATE POLICY ci_empleados_insert_equipo ON public.ci_empleados
  FOR INSERT TO authenticated
  WITH CHECK (public.ci_tiene_permiso_en_entidad('equipo.gestionar', entidad_id));

CREATE POLICY ci_empleados_update_equipo ON public.ci_empleados
  FOR UPDATE TO authenticated
  USING (public.ci_tiene_permiso_en_entidad('equipo.gestionar', entidad_id))
  WITH CHECK (public.ci_tiene_permiso_en_entidad('equipo.gestionar', entidad_id));

CREATE POLICY ci_empleados_delete_equipo ON public.ci_empleados
  FOR DELETE TO authenticated
  USING (public.ci_tiene_permiso_en_entidad('equipo.gestionar', entidad_id));
