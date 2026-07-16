-- Banco de preguntas por tipo de vacante (p. ej. obrero): texto + opciones JSON con marca de correcta.
-- `opciones`: array JSON [{ "texto": string, "es_correcta": boolean }, ...]

create table if not exists public.ci_preguntas (
  id uuid primary key default gen_random_uuid(),
  tipo_vacante text not null,
  categoria text not null,
  pregunta text not null,
  opciones jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_preguntas_tipo on public.ci_preguntas (tipo_vacante);
create index if not exists idx_ci_preguntas_tipo_cat on public.ci_preguntas (tipo_vacante, categoria);

comment on table public.ci_preguntas is 'Preguntas de examen/selección por tipo de vacante; opciones en JSON con es_correcta.';
comment on column public.ci_preguntas.opciones is 'JSON array: [{ "texto": string, "es_correcta": boolean }, ...]';

alter table public.ci_preguntas enable row level security;

drop policy if exists "ci_preg_select_anon" on public.ci_preguntas;
drop policy if exists "ci_preg_insert_anon" on public.ci_preguntas;
drop policy if exists "ci_preg_update_anon" on public.ci_preguntas;
drop policy if exists "ci_preg_delete_anon" on public.ci_preguntas;
drop policy if exists "ci_preg_select_auth" on public.ci_preguntas;
drop policy if exists "ci_preg_insert_auth" on public.ci_preguntas;
drop policy if exists "ci_preg_update_auth" on public.ci_preguntas;
drop policy if exists "ci_preg_delete_auth" on public.ci_preguntas;
create policy "ci_preg_select_anon" on public.ci_preguntas for select to anon using (true);
create policy "ci_preg_insert_anon" on public.ci_preguntas for insert to anon with check (true);
create policy "ci_preg_update_anon" on public.ci_preguntas for update to anon using (true) with check (true);
create policy "ci_preg_delete_anon" on public.ci_preguntas for delete to anon using (true);
create policy "ci_preg_select_auth" on public.ci_preguntas for select to authenticated using (true);
create policy "ci_preg_insert_auth" on public.ci_preguntas for insert to authenticated with check (true);
create policy "ci_preg_update_auth" on public.ci_preguntas for update to authenticated using (true) with check (true);
create policy "ci_preg_delete_auth" on public.ci_preguntas for delete to authenticated using (true);

insert into public.ci_preguntas (tipo_vacante, categoria, pregunta, opciones) values
(
  'obrero',
  'seguridad',
  '¿Qué haces si encuentras una herramienta dañada?',
  '[
    {"texto": "La uso con cuidado", "es_correcta": false},
    {"texto": "La reporto y pido cambio", "es_correcta": true},
    {"texto": "La dejo donde estaba", "es_correcta": false}
  ]'::jsonb
),
(
  'obrero',
  'integridad',
  'Ves a un compañero guardándose material de la empresa en su mochila.',
  '[
    {"texto": "Lo ignoro", "es_correcta": false},
    {"texto": "Hablo con él y luego reporto si no lo devuelve", "es_correcta": true},
    {"texto": "Le pido la mitad", "es_correcta": false}
  ]'::jsonb
),
(
  'obrero',
  'disciplina',
  '¿Cuál es la regla de los 15 minutos en CASA INTELIGENTE?',
  '[
    {"texto": "Es el tiempo para desayunar", "es_correcta": false},
    {"texto": "Es el límite de compromiso y puntualidad", "es_correcta": true},
    {"texto": "No existe tal regla", "es_correcta": false}
  ]'::jsonb
);
