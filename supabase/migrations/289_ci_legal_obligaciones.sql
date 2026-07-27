-- Biblioteca Legal: Obligaciones del Patrono

create table if not exists public.ci_legal_obligaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text not null,
  base_legal text,
  categoria text not null default 'laboral'
    check (categoria in ('laboral', 'sso', 'tributario', 'mercantil', 'otro')),
  frecuencia text not null default 'permanente'
    check (frecuencia in ('permanente', 'mensual', 'quincenal', 'anual', 'ingreso', 'egreso')),
  estado text not null default 'activo'
    check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ci_legal_obligaciones is
  'Biblioteca Legal: Obligaciones del patrono para auditorías de cumplimiento.';

alter table public.ci_legal_obligaciones enable row level security;

drop policy if exists ci_legal_obligaciones_select on public.ci_legal_obligaciones;
create policy ci_legal_obligaciones_select
  on public.ci_legal_obligaciones for select to authenticated
  using (true); -- Visibilidad general para los autenticados

drop policy if exists ci_legal_obligaciones_insert on public.ci_legal_obligaciones;
create policy ci_legal_obligaciones_insert
  on public.ci_legal_obligaciones for insert to authenticated
  with check (true);

drop policy if exists ci_legal_obligaciones_update on public.ci_legal_obligaciones;
create policy ci_legal_obligaciones_update
  on public.ci_legal_obligaciones for update to authenticated
  using (true);

drop policy if exists ci_legal_obligaciones_delete on public.ci_legal_obligaciones;
create policy ci_legal_obligaciones_delete
  on public.ci_legal_obligaciones for delete to authenticated
  using (true);

-- Trigger para updated_at (opcional, si hay función)
-- drop trigger if exists ci_legal_obligaciones_updated_at on public.ci_legal_obligaciones;
-- create trigger ci_legal_obligaciones_updated_at
--   before update on public.ci_legal_obligaciones
--   for each row
--   execute function public.handle_updated_at();

-- Insertar algunas obligaciones de ejemplo de la guía del patrono
insert into public.ci_legal_obligaciones (titulo, descripcion, base_legal, categoria, frecuencia)
values
  ('Generación de Recibos de Pago', 'Emitir y entregar recibos de pago de nómina quincenal o semanal a todos los trabajadores.', 'Art. 104 LOTTT', 'laboral', 'quincenal'),
  ('Inscripción en el IVSS', 'Inscribir a todo nuevo trabajador en el Sistema de Gestión y Autoliquidación de Empresas (TIUNA) en un lapso no mayor a 3 días hábiles.', 'Ley del Seguro Social', 'sso', 'ingreso'),
  ('Pago de Cesta Ticket', 'Pagar el beneficio de alimentación (Cesta Ticket Socialista) mensualmente.', 'Ley del Cesta Ticket', 'laboral', 'mensual')
on conflict do nothing;

notify pgrst, 'reload schema';
