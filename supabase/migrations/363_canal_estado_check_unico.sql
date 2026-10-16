-- 363 · Canal de facturas: una sola regla de estados.
--
-- check_estado_canal (creada a mano en la base, fuera de migraciones) no admitía
-- 'confirmado', 'rechazado' ni 'error'. Confirmar o rechazar una factura del canal
-- fallaba en silencio y la factura se quedaba «extraído»/«procesando» para siempre.
-- Queda la regla de la migración 185 más 'aprobado_sistema' (189) y 'error_ocr'.
alter table public.ci_facturas_canal_pendientes drop constraint if exists check_estado_canal;
alter table public.ci_facturas_canal_pendientes drop constraint if exists ci_facturas_canal_pendientes_estado_check;
alter table public.ci_facturas_canal_pendientes add constraint ci_facturas_canal_pendientes_estado_check
  check (estado in ('recibido', 'pendiente', 'procesando', 'extraido', 'aprobado_sistema', 'confirmado', 'rechazado', 'error', 'error_ocr'));
