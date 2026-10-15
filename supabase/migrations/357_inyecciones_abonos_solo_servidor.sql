-- Aplicada en producción el 2026-10-15 (inyecciones tras desplegar #432; el abono junto con 358).
-- APLICAR SOLO DESPUÉS de desplegar el cambio de código que hace que
-- /api/contabilidad/inyecciones y /api/proyectos/[proyectoId]/abonos llamen a estas
-- funciones con service_role (y exijan el permiso cco.editar). Si se aplica antes,
-- registrar inyecciones y abonos falla con «permission denied for function».

revoke execute on function public.ci_registrar_inyeccion_capital(uuid, text, numeric, text, numeric, numeric, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.ci_registrar_inyeccion_capital(uuid, text, numeric, text, numeric, numeric, text, text, text, text, text, text, jsonb, text, date) from public, anon, authenticated;
revoke execute on function public.ci_registrar_abono_cliente(uuid, numeric, text, numeric, numeric, text, text, date, text) from public, anon, authenticated;

grant execute on function public.ci_registrar_inyeccion_capital(uuid, text, numeric, text, numeric, numeric, text, text, text, text, text, text, jsonb, text) to service_role;
grant execute on function public.ci_registrar_inyeccion_capital(uuid, text, numeric, text, numeric, numeric, text, text, text, text, text, text, jsonb, text, date) to service_role;
grant execute on function public.ci_registrar_abono_cliente(uuid, numeric, text, numeric, numeric, text, text, date, text) to service_role;
