-- gastos_obra: lectura/escritura para app con clave anon (dashboard en navegador).
-- Ajusta si la tabla ya existe con otras políticas.

create table if not exists public.gastos_obra (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo varchar not null default '',
  disciplina varchar not null default '',
  proveedor varchar not null default '',
  descripcion text,
  costo numeric(15, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gastos_obra enable row level security;

drop policy if exists "gastos_obra_select_anon" on public.gastos_obra;
drop policy if exists "gastos_obra_insert_anon" on public.gastos_obra;
drop policy if exists "gastos_obra_update_anon" on public.gastos_obra;
drop policy if exists "gastos_obra_delete_anon" on public.gastos_obra;
drop policy if exists "gastos_obra_select_auth" on public.gastos_obra;
drop policy if exists "gastos_obra_update_auth" on public.gastos_obra;

create policy "gastos_obra_select_anon" on public.gastos_obra for select to anon using (true);
create policy "gastos_obra_insert_anon" on public.gastos_obra for insert to anon with check (true);
create policy "gastos_obra_update_anon" on public.gastos_obra for update to anon using (true) with check (true);
create policy "gastos_obra_delete_anon" on public.gastos_obra for delete to anon using (true);

create policy "gastos_obra_select_auth" on public.gastos_obra for select to authenticated using (true);
create policy "gastos_obra_update_auth" on public.gastos_obra for update to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
