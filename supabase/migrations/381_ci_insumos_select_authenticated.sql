-- Vista insumos (security_invoker desde 374): la tabla base ci_insumos tenía RLS
-- sin políticas y sin GRANT a authenticated (revoke_grants_rls_no_policy_tables).
-- El invocador no veía filas. Catálogo de códigos/unidades, sin PII ni salarios.
--
-- La vista composicion se une a ci_insumos y a ci_presupuesto_composicion,
-- que tenía el mismo hueco. SELECT autenticado, sin escritura.

GRANT SELECT ON TABLE public.ci_insumos TO authenticated;

DROP POLICY IF EXISTS ci_insumos_select_auth ON public.ci_insumos;
CREATE POLICY ci_insumos_select_auth ON public.ci_insumos
  FOR SELECT TO authenticated
  USING (true);

DO $$
BEGIN
  IF to_regclass('public.ci_presupuesto_composicion') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'GRANT SELECT ON TABLE public.ci_presupuesto_composicion TO authenticated';
  EXECUTE 'DROP POLICY IF EXISTS ci_presupuesto_composicion_select_auth ON public.ci_presupuesto_composicion';
  EXECUTE $p$
    CREATE POLICY ci_presupuesto_composicion_select_auth ON public.ci_presupuesto_composicion
      FOR SELECT TO authenticated
      USING (true)
  $p$;
END
$$;
