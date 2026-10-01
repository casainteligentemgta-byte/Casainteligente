-- 320 · Seguridad: bot de Telegram y pagos a obreros
--
-- Antes: cualquier visitante sin sesión (clave pública del navegador) podía darse de alta como
-- usuario autorizado del bot de Telegram con cualquier rol, y leer, modificar o borrar anticipos
-- y transferencias de dinero a obreros.
--
-- Después: solo el personal con sesión (authenticated) y el servidor (service_role, que usa el bot
-- y las rutas /api) acceden a estas tablas. Las políticas de "authenticated" no cambian.

begin;

-- Bot de Telegram: usuarios del sistema y lista blanca de chats
drop policy if exists ci_usuarios_sistema_telegram_all_anon on public.ci_usuarios_sistema_telegram;
drop policy if exists ci_telegram_whitelist_select_anon on public.ci_telegram_whitelist;
drop policy if exists ci_telegram_whitelist_insert_anon on public.ci_telegram_whitelist;
drop policy if exists ci_telegram_whitelist_update_anon on public.ci_telegram_whitelist;
drop policy if exists ci_telegram_whitelist_delete_anon on public.ci_telegram_whitelist;

-- Pagos a obreros: transferencias y anticipos mensuales
drop policy if exists obreros_transferencia_select_anon on public.obreros_transferencia_dinero;
drop policy if exists obreros_transferencia_insert_anon on public.obreros_transferencia_dinero;
drop policy if exists obreros_transferencia_update_anon on public.obreros_transferencia_dinero;
drop policy if exists obreros_transferencia_delete_anon on public.obreros_transferencia_dinero;
drop policy if exists obra_digital_advances_select_anon on public.obra_digital_monthly_advances;
drop policy if exists obra_digital_advances_insert_anon on public.obra_digital_monthly_advances;
drop policy if exists obra_digital_advances_update_anon on public.obra_digital_monthly_advances;
drop policy if exists obra_digital_advances_delete_anon on public.obra_digital_monthly_advances;

commit;
