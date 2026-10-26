-- Salarios y datos personales: restringir lectura por rol y respetar RLS en vistas.
--
-- Hallazgos:
--  * ci_labor_salary_history y ci_labor_benefit_configs tenían política SELECT con
--    `using true`: cualquier usuario autenticado podía leer salarios.
--  * Las vistas del esquema public son propiedad de postgres y no tenían
--    security_invoker, así que ejecutaban con permisos del dueño y saltaban el RLS
--    de las tablas base (cédulas, celulares, salarios).
--
-- Decisión: salarios y beneficios solo para super_admin, entidad_admin, director y rrhh.
-- Las vistas pasan a security_invoker = true para que apliquen el RLS de sus tablas base.

-- 1) Salarios y beneficios: solo roles autorizados.
DROP POLICY IF EXISTS ci_labor_salary_history_select_auth ON public.ci_labor_salary_history;
CREATE POLICY ci_labor_salary_history_select_roles ON public.ci_labor_salary_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.get_auth_user_context() uc(out_rol, out_entidad_id)
      WHERE uc.out_rol::text IN ('super_admin', 'entidad_admin', 'director', 'rrhh')
    )
  );

DROP POLICY IF EXISTS ci_labor_benefit_configs_select_auth ON public.ci_labor_benefit_configs;
CREATE POLICY ci_labor_benefit_configs_select_roles ON public.ci_labor_benefit_configs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.get_auth_user_context() uc(out_rol, out_entidad_id)
      WHERE uc.out_rol::text IN ('super_admin', 'entidad_admin', 'director', 'rrhh')
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
