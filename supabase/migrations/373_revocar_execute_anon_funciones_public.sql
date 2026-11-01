-- Endurecimiento: funciones SECURITY DEFINER en public ejecutables por anon.
--
-- Hallazgo del advisor de seguridad de Supabase (0028 anon_security_definer_function_executable).
-- Cualquier visitante sin sesión podía invocar estas funciones por RPC.
--
-- Criterio:
--  * Triggers: el disparo de un trigger no requiere EXECUTE, así que no necesitan
--    ningún permiso expuesto. Se revoca de PUBLIC, anon y authenticated.
--  * Funciones RPC y helpers usados por RLS: se revoca de PUBLIC y anon.
--    authenticated y service_role conservan EXECUTE. Las que validan auth.uid()
--    ya rechazaban a usuarios anónimos; el cambio cierra la superficie pública.
--
-- Verificado antes: ninguna de estas funciones se llama por RPC desde código sin sesión.
-- Las dos RPC de abonos que usa la app (ci_registrar_abono_presupuesto y
-- ci_reaplicar_abonos_presupuesto) exigen sesión.

DO $$
DECLARE
  r record;
BEGIN
  -- Triggers: sin permiso expuesto.
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'trigger'::regtype
      AND p.proname IN (
        'ci_empleados_propaga_firma_electronica_contrato',
        'ci_entidad_inicializar_catalogo',
        'customers_no_borrar_con_presupuestos',
        'handle_new_user',
        'handle_organization_assignment',
        'inv_compra_registrar_stock',
        'inv_transferencia_estado_stock',
        'inv_trg_ci_proyecto_before_delete_ubicacion_obra',
        'inv_trg_ci_proyecto_ubicacion_obra',
        'inv_validar_imputacion_partida',
        'sync_purchase_detail_estado_logistica'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
  END LOOP;

  -- RPC y helpers de RLS: sin acceso para anónimos.
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype
      AND p.proname IN (
        'check_user_access',
        'ci_aplicar_abono_a_cuotas',
        'ci_legal_has_org_access',
        'ci_legal_has_org_write_access',
        'ci_reaplicar_abonos_presupuesto',
        'ci_recalcular_cobro_presupuesto',
        'ci_registrar_abono_presupuesto',
        'ci_usuarios_roles_soy_gestor',
        'get_auth_user_context',
        'is_org_admin',
        'is_org_member'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);
  END LOOP;
END $$;
