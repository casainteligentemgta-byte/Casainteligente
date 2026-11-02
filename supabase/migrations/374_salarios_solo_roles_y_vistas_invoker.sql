-- Salarios y datos personales: restringir lectura por rol y respetar RLS en vistas.
--
-- Hallazgos:
--  * ci_labor_salary_history y ci_labor_benefit_configs tenían política SELECT con
--    `using true`: cualquier usuario autenticado podía leer salarios.
--  * Las vistas del esquema public son propiedad de postgres y no tenían
--    security_invoker, así que ejecutaban con permisos del dueño y saltaban el RLS
--    de las tablas base (cédulas, celulares, salarios).
--
-- Decisión: mismos roles y alcance que «Aislamiento estricto de proyectos por Entidad
-- y Rol» en ci_proyectos. super_admin ve todas las filas. entidad_admin, director y
-- rrhh solo ven salarios/beneficios de trabajadores de su entidad
-- (ci_empleados.entidad_id vía worker_id). Las vistas pasan a security_invoker = true.

-- 1) Salarios y beneficios: rol autorizado + alcance de entidad.
DROP POLICY IF EXISTS ci_labor_salary_history_select_auth ON public.ci_labor_salary_history;
DROP POLICY IF EXISTS ci_labor_salary_history_select_roles ON public.ci_labor_salary_history;
CREATE POLICY ci_labor_salary_history_select_roles ON public.ci_labor_salary_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.get_auth_user_context() uc(out_rol, out_entidad_id)
      WHERE uc.out_rol = 'super_admin'::public.ci_rol_sistema
         OR (
           uc.out_entidad_id = (
             SELECT e.entidad_id
             FROM public.ci_empleados e
             WHERE e.id = ci_labor_salary_history.worker_id
           )
           AND uc.out_rol = ANY (ARRAY[
             'entidad_admin'::public.ci_rol_sistema,
             'director'::public.ci_rol_sistema,
             'rrhh'::public.ci_rol_sistema
           ])
         )
    )
  );

DROP POLICY IF EXISTS ci_labor_benefit_configs_select_auth ON public.ci_labor_benefit_configs;
DROP POLICY IF EXISTS ci_labor_benefit_configs_select_roles ON public.ci_labor_benefit_configs;
CREATE POLICY ci_labor_benefit_configs_select_roles ON public.ci_labor_benefit_configs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.get_auth_user_context() uc(out_rol, out_entidad_id)
      WHERE uc.out_rol = 'super_admin'::public.ci_rol_sistema
         OR (
           uc.out_entidad_id = (
             SELECT e.entidad_id
             FROM public.ci_empleados e
             WHERE e.id = ci_labor_benefit_configs.worker_id
           )
           AND uc.out_rol = ANY (ARRAY[
             'entidad_admin'::public.ci_rol_sistema,
             'director'::public.ci_rol_sistema,
             'rrhh'::public.ci_rol_sistema
           ])
         )
    )
  );

-- 2) Vistas: respetan el RLS de la tabla base del usuario que consulta.
ALTER VIEW public.workers SET (security_invoker = true);
ALTER VIEW public.salary_history SET (security_invoker = true);
ALTER VIEW public.benefit_configs SET (security_invoker = true);
ALTER VIEW public.ci_personal_activos SET (security_invoker = true);
ALTER VIEW public.ci_postulantes_reclutamiento SET (security_invoker = true);
ALTER VIEW public.documentos_por_vencer SET (security_invoker = true);
ALTER VIEW public.global_labor_overview SET (security_invoker = true);
ALTER VIEW public.ci_compras SET (security_invoker = true);
ALTER VIEW public.hojas_vida SET (security_invoker = true);
ALTER VIEW public.composicion SET (security_invoker = true);
ALTER VIEW public.vista_cuadro_procuras SET (security_invoker = true);
ALTER VIEW public.insumos SET (security_invoker = true);
