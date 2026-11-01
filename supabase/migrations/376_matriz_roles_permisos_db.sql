-- Paso 2 de 2: matriz de roles y permisos en base de datos (fuente de verdad para RLS).
-- Requiere que 375_roles_empresa_enum.sql ya esté aplicada.
--
-- Antes: los roles de empresa (comprador, contador, etc.) de lib/auth/permisosCatalogo.ts
-- no podían guardarse en ci_usuarios_roles, y ci_empleados/employees tenían políticas `using true`.
--
-- Esta migración:
--  1) Guarda la matriz rol → permiso en ci_rol_permisos (mismo contenido que permisosCatalogo.ts).
--  2) Crea ci_tiene_permiso(text) para usar en políticas RLS.
--  3) Restringe ci_empleados a equipo.gestionar y quita la política abierta de employees.
--
-- Mapeo: super_admin y entidad_admin = todos los permisos. director = permisos de pm_obra.
-- rrhh = equipo.gestionar (salarios se controlan en la migración 374).

-- 1) Matriz rol → permiso.
CREATE TABLE IF NOT EXISTS public.ci_rol_permisos (
  rol public.ci_rol_sistema NOT NULL,
  permiso text NOT NULL,
  PRIMARY KEY (rol, permiso)
);

ALTER TABLE public.ci_rol_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ci_rol_permisos_select_auth ON public.ci_rol_permisos;
CREATE POLICY ci_rol_permisos_select_auth ON public.ci_rol_permisos
  FOR SELECT TO authenticated USING (true);

-- Sin políticas de escritura: solo el service role modifica la matriz.

INSERT INTO public.ci_rol_permisos (rol, permiso) VALUES
  -- super_admin y entidad_admin: todos los permisos
  ('super_admin', 'procura.solicitar'), ('super_admin', 'procura.crear'), ('super_admin', 'procura.aprobar'),
  ('super_admin', 'procura.ejecutar_compra'), ('super_admin', 'procura.usar_almacen'),
  ('super_admin', 'compra.registrar'), ('super_admin', 'compra.verificar_fecha'), ('super_admin', 'compra.confirmar'),
  ('super_admin', 'almacen.ingreso'), ('super_admin', 'almacen.despacho'), ('super_admin', 'almacen.cuarentena'),
  ('super_admin', 'admin.config'), ('super_admin', 'equipo.gestionar'), ('super_admin', 'cco.ver'),
  ('super_admin', 'cco.editar'), ('super_admin', 'flota.gestionar'),
  ('entidad_admin', 'procura.solicitar'), ('entidad_admin', 'procura.crear'), ('entidad_admin', 'procura.aprobar'),
  ('entidad_admin', 'procura.ejecutar_compra'), ('entidad_admin', 'procura.usar_almacen'),
  ('entidad_admin', 'compra.registrar'), ('entidad_admin', 'compra.verificar_fecha'), ('entidad_admin', 'compra.confirmar'),
  ('entidad_admin', 'almacen.ingreso'), ('entidad_admin', 'almacen.despacho'), ('entidad_admin', 'almacen.cuarentena'),
  ('entidad_admin', 'admin.config'), ('entidad_admin', 'equipo.gestionar'), ('entidad_admin', 'cco.ver'),
  ('entidad_admin', 'cco.editar'), ('entidad_admin', 'flota.gestionar'),
  -- director: permisos de pm_obra
  ('director', 'procura.solicitar'), ('director', 'procura.aprobar'), ('director', 'procura.usar_almacen'),
  ('director', 'compra.registrar'), ('director', 'almacen.despacho'), ('director', 'equipo.gestionar'),
  ('director', 'cco.ver'), ('director', 'cco.editar'), ('director', 'flota.gestionar'),
  -- pm_obra
  ('pm_obra', 'procura.solicitar'), ('pm_obra', 'procura.aprobar'), ('pm_obra', 'procura.usar_almacen'),
  ('pm_obra', 'compra.registrar'), ('pm_obra', 'almacen.despacho'), ('pm_obra', 'equipo.gestionar'),
  ('pm_obra', 'cco.ver'), ('pm_obra', 'cco.editar'), ('pm_obra', 'flota.gestionar'),
  -- contador
  ('contador', 'compra.registrar'), ('contador', 'compra.verificar_fecha'), ('contador', 'compra.confirmar'),
  ('contador', 'procura.solicitar'), ('contador', 'cco.ver'), ('contador', 'cco.editar'),
  -- comprador
  ('comprador', 'procura.solicitar'), ('comprador', 'procura.crear'), ('comprador', 'procura.ejecutar_compra'),
  ('comprador', 'procura.usar_almacen'), ('comprador', 'compra.registrar'), ('comprador', 'compra.confirmar'),
  ('comprador', 'almacen.ingreso'), ('comprador', 'cco.ver'),
  -- almacen_central
  ('almacen_central', 'procura.usar_almacen'), ('almacen_central', 'almacen.ingreso'),
  ('almacen_central', 'almacen.despacho'), ('almacen_central', 'almacen.cuarentena'),
  ('almacen_central', 'compra.registrar'), ('almacen_central', 'cco.ver'), ('almacen_central', 'flota.gestionar'),
  -- rrhh
  ('rrhh', 'equipo.gestionar'),
  -- solo_lectura y cco_lectura
  ('solo_lectura', 'cco.ver'), ('cco_lectura', 'cco.ver')
ON CONFLICT DO NOTHING;

-- 2) Función para RLS. SECURITY DEFINER para no depender de las políticas de ci_usuarios_roles.
CREATE OR REPLACE FUNCTION public.ci_tiene_permiso(p_permiso text)
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
  );
$$;

REVOKE EXECUTE ON FUNCTION public.ci_tiene_permiso(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ci_tiene_permiso(text) TO authenticated, service_role;

-- 3) ci_empleados: solo equipo.gestionar lee, crea, edita y borra.
-- Nombres verificados en pg_policies de casainteligenteapp.
DROP POLICY IF EXISTS ci_empleados_admin_all ON public.ci_empleados;
DROP POLICY IF EXISTS ci_empleados_select_auth ON public.ci_empleados;
DROP POLICY IF EXISTS ci_empleados_insert_auth ON public.ci_empleados;
DROP POLICY IF EXISTS ci_empleados_update_auth ON public.ci_empleados;
DROP POLICY IF EXISTS ci_empleados_delete_auth ON public.ci_empleados;

CREATE POLICY ci_empleados_select_equipo ON public.ci_empleados
  FOR SELECT TO authenticated USING (public.ci_tiene_permiso('equipo.gestionar'));
CREATE POLICY ci_empleados_insert_equipo ON public.ci_empleados
  FOR INSERT TO authenticated WITH CHECK (public.ci_tiene_permiso('equipo.gestionar'));
CREATE POLICY ci_empleados_update_equipo ON public.ci_empleados
  FOR UPDATE TO authenticated
  USING (public.ci_tiene_permiso('equipo.gestionar'))
  WITH CHECK (public.ci_tiene_permiso('equipo.gestionar'));
CREATE POLICY ci_empleados_delete_equipo ON public.ci_empleados
  FOR DELETE TO authenticated USING (public.ci_tiene_permiso('equipo.gestionar'));

-- Se conservan las políticas anónimas de invitación por token:
-- ci_empleados_insert_con_enlace, ci_empleados_public_read_by_token, ci_empleados_public_update_by_token.

-- 4) employees: quitar la política abierta. Las de organización (employees_org_*, employees_select,
-- employees_update, employees_delete, employees_insert, employees_org_insert) se conservan.
DROP POLICY IF EXISTS "Permiso total para usuarios autenticados" ON public.employees;
