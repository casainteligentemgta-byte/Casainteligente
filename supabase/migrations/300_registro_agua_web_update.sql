-- Alta/edición web del registro de agua: políticas update + authenticated.

drop policy if exists "registro_agua_obrero_select_authenticated" on public.registro_agua_obrero;
create policy "registro_agua_obrero_select_authenticated"
  on public.registro_agua_obrero for select to authenticated using (true);

drop policy if exists "registro_agua_obrero_insert_authenticated" on public.registro_agua_obrero;
create policy "registro_agua_obrero_insert_authenticated"
  on public.registro_agua_obrero for insert to authenticated with check (true);

drop policy if exists "registro_agua_obrero_update_anon" on public.registro_agua_obrero;
create policy "registro_agua_obrero_update_anon"
  on public.registro_agua_obrero for update to anon using (true) with check (true);

drop policy if exists "registro_agua_obrero_update_authenticated" on public.registro_agua_obrero;
create policy "registro_agua_obrero_update_authenticated"
  on public.registro_agua_obrero for update to authenticated using (true) with check (true);

comment on table public.registro_agua_obrero is
  'Registro de agua en obra: Telegram (/agua) o carga web con fotos y fecha editable.';

notify pgrst, 'reload schema';
