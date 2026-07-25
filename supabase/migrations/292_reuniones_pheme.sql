-- Tabla del prototipo Python Pheme: audio → diarización → minuta JSON → Postgres.
-- Complementa ci_pheme_reuniones (291) con el schema exacto del script.

create table if not exists public.reuniones_pheme (
  id_reunion serial primary key,
  titulo_reunion text not null,
  duracion_minutos integer null,
  transcripcion_raw text not null default '',
  resumen_ejecutivo text not null default '',
  minuta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_reuniones_pheme_created
  on public.reuniones_pheme (created_at desc);

comment on table public.reuniones_pheme is
  'Minutas Pheme (prototipo): transcripción diarizada + minuta_json completo.';
comment on column public.reuniones_pheme.transcripcion_raw is
  'Transcripción literal con etiquetas de hablante (Hablante 1 / Nombre).';
comment on column public.reuniones_pheme.minuta_json is
  'JSON: resumen_ejecutivo, puntos_clave, acuerdos, pendientes_o_alertas.';

alter table public.reuniones_pheme enable row level security;

drop policy if exists "reuniones_pheme_select_auth" on public.reuniones_pheme;
drop policy if exists "reuniones_pheme_insert_auth" on public.reuniones_pheme;
drop policy if exists "reuniones_pheme_select_anon" on public.reuniones_pheme;

create policy "reuniones_pheme_select_auth" on public.reuniones_pheme
  for select to authenticated using (true);
create policy "reuniones_pheme_insert_auth" on public.reuniones_pheme
  for insert to authenticated with check (true);
create policy "reuniones_pheme_select_anon" on public.reuniones_pheme
  for select to anon using (true);

-- Enriquecer tabla CI con campos del flujo audio.
alter table public.ci_pheme_reuniones
  add column if not exists duracion_minutos integer null;
alter table public.ci_pheme_reuniones
  add column if not exists minuta_json jsonb null;
alter table public.ci_pheme_reuniones
  add column if not exists id_reunion_prototipo integer null
    references public.reuniones_pheme (id_reunion) on delete set null;

notify pgrst, 'reload schema';
