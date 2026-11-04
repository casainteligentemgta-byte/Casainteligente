-- Defensa en profundidad: quita grants de `anon` en sueldos, nómina, roles y
-- dinero. Las políticas ya son TO authenticated (anon no leía filas); un cambio
-- de política o una vista definer no debe reabrir esto al público.
--
-- No toca ci_empleados ni ci_hojas_vida (enlace del candidato).
-- No reescribe datos. Idempotente.

revoke all on table public.ci_labor_salary_history from anon;
revoke all on table public.ci_labor_benefit_configs from anon;
revoke all on table public.ci_tabulador_salarial from anon;
revoke all on table public.ci_nomina_items from anon;
revoke all on table public.ci_nomina_periodos from anon;
revoke all on table public.ci_prestaciones_adelantos from anon;
revoke all on table public.ci_inyecciones_capital from anon;
revoke all on table public.ci_usuarios_roles from anon;
revoke all on table public.ci_rol_permisos from anon;
revoke all on table public.ci_proyecto_admin_historial from anon;
revoke all on table public.obreros_transferencia_dinero from anon;
revoke all on table public.registros_gastos from anon;
revoke all on table public.registros_gastos_staging from anon;
revoke all on table public.employees from anon;

-- Vista de catálogo: solo lectura. El enmascarado de costo exige security_invoker=false
-- (migración 398); no se cambia. Sí se quitan writes que no deberían existir.
revoke all on table public.products_lectura from anon;
revoke all on table public.products_lectura from public;
revoke insert, update, delete, truncate on table public.products_lectura from authenticated;
grant select on table public.products_lectura to authenticated;

notify pgrst, 'reload schema';
