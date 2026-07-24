-- La web usa sesión authenticated; las políticas solo anon impedían ver facturas de Telegram.

drop policy if exists "ci_facturas_canal_select_authenticated" on public.ci_facturas_canal_pendientes;
drop policy if exists "ci_facturas_canal_insert_authenticated" on public.ci_facturas_canal_pendientes;
drop policy if exists "ci_facturas_canal_update_authenticated" on public.ci_facturas_canal_pendientes;
drop policy if exists "ci_facturas_canal_delete_authenticated" on public.ci_facturas_canal_pendientes;

create policy "ci_facturas_canal_select_authenticated"
  on public.ci_facturas_canal_pendientes for select to authenticated using (true);
create policy "ci_facturas_canal_insert_authenticated"
  on public.ci_facturas_canal_pendientes for insert to authenticated with check (true);
create policy "ci_facturas_canal_update_authenticated"
  on public.ci_facturas_canal_pendientes for update to authenticated using (true) with check (true);
create policy "ci_facturas_canal_delete_authenticated"
  on public.ci_facturas_canal_pendientes for delete to authenticated using (true);

drop policy if exists "ci_telegram_estados_select_authenticated" on public.ci_telegram_estados;
drop policy if exists "ci_telegram_estados_insert_authenticated" on public.ci_telegram_estados;
drop policy if exists "ci_telegram_estados_update_authenticated" on public.ci_telegram_estados;
drop policy if exists "ci_telegram_estados_delete_authenticated" on public.ci_telegram_estados;

create policy "ci_telegram_estados_select_authenticated"
  on public.ci_telegram_estados for select to authenticated using (true);
create policy "ci_telegram_estados_insert_authenticated"
  on public.ci_telegram_estados for insert to authenticated with check (true);
create policy "ci_telegram_estados_update_authenticated"
  on public.ci_telegram_estados for update to authenticated using (true) with check (true);
create policy "ci_telegram_estados_delete_authenticated"
  on public.ci_telegram_estados for delete to authenticated using (true);

notify pgrst, 'reload schema';
