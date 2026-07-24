-- PostgREST: la tabla tenía RLS sin políticas → anon no podía insertar/select.
-- Alineado con ci_obras / ci_proyectos (operaciones vía API Next con clave anónima en servidor).

alter table public.recruitment_needs enable row level security;

drop policy if exists "recruitment_needs_select_anon" on public.recruitment_needs;
drop policy if exists "recruitment_needs_insert_anon" on public.recruitment_needs;
drop policy if exists "recruitment_needs_update_anon" on public.recruitment_needs;
drop policy if exists "recruitment_needs_delete_anon" on public.recruitment_needs;
drop policy if exists "recruitment_needs_select_auth" on public.recruitment_needs;
drop policy if exists "recruitment_needs_insert_auth" on public.recruitment_needs;
drop policy if exists "recruitment_needs_update_auth" on public.recruitment_needs;
drop policy if exists "recruitment_needs_delete_auth" on public.recruitment_needs;

create policy "recruitment_needs_select_anon" on public.recruitment_needs for select to anon using (true);
create policy "recruitment_needs_insert_anon" on public.recruitment_needs for insert to anon with check (true);
create policy "recruitment_needs_update_anon" on public.recruitment_needs for update to anon using (true) with check (true);
create policy "recruitment_needs_delete_anon" on public.recruitment_needs for delete to anon using (true);

create policy "recruitment_needs_select_auth" on public.recruitment_needs for select to authenticated using (true);
create policy "recruitment_needs_insert_auth" on public.recruitment_needs for insert to authenticated with check (true);
create policy "recruitment_needs_update_auth" on public.recruitment_needs for update to authenticated using (true) with check (true);
create policy "recruitment_needs_delete_auth" on public.recruitment_needs for delete to authenticated using (true);

grant select, insert, update, delete on table public.recruitment_needs to anon, authenticated, service_role;

notify pgrst, 'reload schema';
