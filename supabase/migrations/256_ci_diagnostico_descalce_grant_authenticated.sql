-- Permite invocar la RPC desde el cliente web autenticado (PanelAuditoriaProcuras).

grant execute on function public.ci_diagnostico_descalce_procuras() to authenticated;

notify pgrst, 'reload schema';
