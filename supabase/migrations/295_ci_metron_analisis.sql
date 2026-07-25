-- Metron: análisis de planos → cómputos y prepresupuesto borrador.

create table if not exists public.ci_metron_analisis (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  plano_archivo_id uuid null references public.ci_proyecto_archivos (id) on delete set null,
  disciplina text not null default 'desconocida'
    check (disciplina in ('arq', 'est', 'ele', 'san', 'red', 'cctv', 'mixta', 'desconocida')),
  especialidades jsonb not null default '[]'::jsonb,
  titulo_plano text not null default '',
  escala_detectada text not null default '',
  resumen text not null default '',
  supuestos jsonb not null default '[]'::jsonb,
  alertas jsonb not null default '[]'::jsonb,
  status text not null default 'borrador'
    check (status in ('borrador', 'revisado', 'aplicado', 'error')),
  modelo text null,
  archivo_nombre text not null default '',
  mime_type text not null default '',
  public_url text null,
  raw_json jsonb not null default '{}'::jsonb,
  error_mensaje text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_metron_analisis_proyecto
  on public.ci_metron_analisis (proyecto_id, created_at desc);

create index if not exists idx_ci_metron_analisis_plano
  on public.ci_metron_analisis (plano_archivo_id)
  where plano_archivo_id is not null;

create index if not exists idx_ci_metron_analisis_status
  on public.ci_metron_analisis (status);

comment on table public.ci_metron_analisis is
  'Metron: análisis de planos (ARQ/EST/ELE/SAN/RED/CCTV) con resumen y alertas.';
comment on column public.ci_metron_analisis.especialidades is
  'JSON array de disciplinas detectadas, ej. ["arq","ele"].';
comment on column public.ci_metron_analisis.supuestos is
  'JSON array de strings: supuestos del cómputo.';
comment on column public.ci_metron_analisis.alertas is
  'JSON array de strings: riesgos, escala dudosa, faltantes.';

create table if not exists public.ci_metron_computos (
  id uuid primary key default gen_random_uuid(),
  analisis_id uuid not null references public.ci_metron_analisis (id) on delete cascade,
  orden int not null default 0,
  codigo_sugerido text not null default '',
  descripcion text not null default '',
  unidad text not null default 'UND',
  cantidad numeric(15, 4) not null default 0,
  precio_unitario_estimado numeric(15, 4) not null default 0,
  monto_estimado numeric(15, 2) not null default 0,
  capitulo_sugerido text not null default '',
  supuesto text not null default '',
  confianza numeric(5, 2) not null default 0,
  disciplina text not null default 'arq'
    check (disciplina in ('arq', 'est', 'ele', 'san', 'red', 'cctv', 'mixta', 'desconocida')),
  aprobado boolean not null default true,
  partida_id uuid null references public.ci_presupuesto_partidas (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_metron_computos_analisis
  on public.ci_metron_computos (analisis_id, orden);

comment on table public.ci_metron_computos is
  'Metron: líneas de cómputo métrico / prepresupuesto generadas desde planos.';
comment on column public.ci_metron_computos.confianza is
  'Confianza 0–100 del ítem de cómputo.';
comment on column public.ci_metron_computos.precio_unitario_estimado is
  'Precio unitario indicativo (USD o moneda de obra); revisar antes de aplicar.';

alter table public.ci_metron_analisis enable row level security;
alter table public.ci_metron_computos enable row level security;

drop policy if exists "metron_analisis_select_auth" on public.ci_metron_analisis;
drop policy if exists "metron_analisis_insert_auth" on public.ci_metron_analisis;
drop policy if exists "metron_analisis_update_auth" on public.ci_metron_analisis;
drop policy if exists "metron_analisis_select_anon" on public.ci_metron_analisis;

create policy "metron_analisis_select_auth" on public.ci_metron_analisis
  for select to authenticated using (true);
create policy "metron_analisis_insert_auth" on public.ci_metron_analisis
  for insert to authenticated with check (true);
create policy "metron_analisis_update_auth" on public.ci_metron_analisis
  for update to authenticated using (true) with check (true);
create policy "metron_analisis_select_anon" on public.ci_metron_analisis
  for select to anon using (true);

drop policy if exists "metron_computos_select_auth" on public.ci_metron_computos;
drop policy if exists "metron_computos_insert_auth" on public.ci_metron_computos;
drop policy if exists "metron_computos_update_auth" on public.ci_metron_computos;
drop policy if exists "metron_computos_select_anon" on public.ci_metron_computos;

create policy "metron_computos_select_auth" on public.ci_metron_computos
  for select to authenticated using (true);
create policy "metron_computos_insert_auth" on public.ci_metron_computos
  for insert to authenticated with check (true);
create policy "metron_computos_update_auth" on public.ci_metron_computos
  for update to authenticated using (true) with check (true);
create policy "metron_computos_select_anon" on public.ci_metron_computos
  for select to anon using (true);

notify pgrst, 'reload schema';
