-- Pheme: persistencia de minutas de reuniones (Gemini → JSON → Postgres).
-- Equivalente al flujo Python `procesar_reunion_con_pheme` + INSERT.

create table if not exists public.ci_pheme_reuniones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  transcripcion text not null default '',
  resumen_ejecutivo text not null default '',
  puntos_clave jsonb not null default '[]'::jsonb,
  acuerdos jsonb not null default '[]'::jsonb,
  pendientes_o_alertas jsonb not null default '[]'::jsonb,
  markdown text not null default '',
  modelo text null,
  desde_gemini boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_pheme_reuniones_created
  on public.ci_pheme_reuniones (created_at desc);

create index if not exists idx_ci_pheme_reuniones_titulo
  on public.ci_pheme_reuniones using gin (to_tsvector('spanish', coalesce(titulo, '')));

comment on table public.ci_pheme_reuniones is
  'Minutas Pheme: resumen, puntos clave, acuerdos y pendientes/alertas de reuniones.';
comment on column public.ci_pheme_reuniones.acuerdos is
  'JSON array: [{ "tarea", "responsable", "fecha_limite" }]';
comment on column public.ci_pheme_reuniones.pendientes_o_alertas is
  'JSON array de strings (schema del prototipo Pheme).';

alter table public.ci_pheme_reuniones enable row level security;

drop policy if exists "pheme_reuniones_select_auth" on public.ci_pheme_reuniones;
drop policy if exists "pheme_reuniones_insert_auth" on public.ci_pheme_reuniones;
drop policy if exists "pheme_reuniones_select_anon" on public.ci_pheme_reuniones;

create policy "pheme_reuniones_select_auth" on public.ci_pheme_reuniones
  for select to authenticated using (true);
create policy "pheme_reuniones_insert_auth" on public.ci_pheme_reuniones
  for insert to authenticated with check (true);
-- Lectura anon opcional (CRM sin sesión); escritura vía service_role en API.
create policy "pheme_reuniones_select_anon" on public.ci_pheme_reuniones
  for select to anon using (true);

notify pgrst, 'reload schema';
