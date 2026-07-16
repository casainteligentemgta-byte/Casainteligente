-- Hardening seguridad procuras (auditoría H-01):
-- - RPC procesar_procuras_lote solo service_role (backend Vercel/Telegram)
-- - RLS ci_procuras / historial: sin acceso directo anon/authenticated

revoke execute on function public.procesar_procuras_lote(uuid[], text, text) from anon;
revoke execute on function public.procesar_procuras_lote(uuid[], text, text) from authenticated;
grant execute on function public.procesar_procuras_lote(uuid[], text, text) to service_role;

-- ci_procuras: eliminar políticas permisivas
drop policy if exists "ci_procuras_select_anon" on public.ci_procuras;
drop policy if exists "ci_procuras_insert_anon" on public.ci_procuras;
drop policy if exists "ci_procuras_update_anon" on public.ci_procuras;
drop policy if exists "ci_procuras_delete_anon" on public.ci_procuras;
drop policy if exists "ci_procuras_select_auth" on public.ci_procuras;
drop policy if exists "ci_procuras_insert_auth" on public.ci_procuras;
drop policy if exists "ci_procuras_update_auth" on public.ci_procuras;
drop policy if exists "ci_procuras_delete_auth" on public.ci_procuras;

-- ci_procura_estados_historial
drop policy if exists "ci_procura_hist_select_anon" on public.ci_procura_estados_historial;
drop policy if exists "ci_procura_hist_insert_anon" on public.ci_procura_estados_historial;
drop policy if exists "ci_procura_hist_select_auth" on public.ci_procura_estados_historial;
drop policy if exists "ci_procura_hist_insert_auth" on public.ci_procura_estados_historial;

comment on function public.procesar_procuras_lote(uuid[], text, text) is
  'Solo service_role (API/Telegram). No expuesto a anon/authenticated.';

notify pgrst, 'reload schema';
