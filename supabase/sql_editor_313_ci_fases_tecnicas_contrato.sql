-- Ejecutar en SQL Editor de Supabase (producción) si la migración 313 aún no está aplicada.
-- Fases técnicas editables + catálogo reutilizable + default por obra.

create table if not exists public.ci_fases_tecnicas_contrato (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  clave_norm text not null,
  usos_count integer not null default 1,
  ultimo_uso_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_fases_tecnicas_contrato_texto_chk check (char_length(trim(texto)) >= 2),
  constraint ci_fases_tecnicas_contrato_clave_uniq unique (clave_norm)
);

comment on table public.ci_fases_tecnicas_contrato is
  'Catálogo de fases técnicas usadas en contratos laborales (cláusula PRIMERA). Se reutilizan en próximas obras/contratos.';
comment on column public.ci_fases_tecnicas_contrato.texto is
  'Texto literal de la fase técnica tal como aparece en el contrato.';
comment on column public.ci_fases_tecnicas_contrato.clave_norm is
  'Clave normalizada (minúsculas, sin acentos, espacios colapsados) para deduplicar.';
comment on column public.ci_fases_tecnicas_contrato.usos_count is
  'Cuántas veces se ha grabado/usado esta fase.';

create index if not exists idx_ci_fases_tecnicas_contrato_ultimo
  on public.ci_fases_tecnicas_contrato (ultimo_uso_at desc);

create index if not exists idx_ci_fases_tecnicas_contrato_usos
  on public.ci_fases_tecnicas_contrato (usos_count desc);

alter table public.ci_fases_tecnicas_contrato enable row level security;

drop policy if exists "ci_fases_tec_select_anon" on public.ci_fases_tecnicas_contrato;
drop policy if exists "ci_fases_tec_select_auth" on public.ci_fases_tecnicas_contrato;
drop policy if exists "ci_fases_tec_insert_anon" on public.ci_fases_tecnicas_contrato;
drop policy if exists "ci_fases_tec_insert_auth" on public.ci_fases_tecnicas_contrato;
drop policy if exists "ci_fases_tec_update_anon" on public.ci_fases_tecnicas_contrato;
drop policy if exists "ci_fases_tec_update_auth" on public.ci_fases_tecnicas_contrato;

create policy "ci_fases_tec_select_anon"
  on public.ci_fases_tecnicas_contrato for select to anon using (true);
create policy "ci_fases_tec_select_auth"
  on public.ci_fases_tecnicas_contrato for select to authenticated using (true);
create policy "ci_fases_tec_insert_anon"
  on public.ci_fases_tecnicas_contrato for insert to anon with check (true);
create policy "ci_fases_tec_insert_auth"
  on public.ci_fases_tecnicas_contrato for insert to authenticated with check (true);
create policy "ci_fases_tec_update_anon"
  on public.ci_fases_tecnicas_contrato for update to anon using (true) with check (true);
create policy "ci_fases_tec_update_auth"
  on public.ci_fases_tecnicas_contrato for update to authenticated using (true) with check (true);

alter table public.ci_proyectos
  add column if not exists fase_tecnica_contrato_default text;

comment on column public.ci_proyectos.fase_tecnica_contrato_default is
  'Fase técnica por defecto (cláusula PRIMERA) para contratos de esta obra. Editable y reutilizable.';

insert into public.ci_fases_tecnicas_contrato (texto, clave_norm, usos_count)
values
  (
    'fundaciones y movimiento de tierra',
    'fundaciones y movimiento de tierra',
    0
  ),
  (
    'estructura de concreto armado',
    'estructura de concreto armado',
    0
  ),
  (
    'mampostería y cerramientos',
    'mamposteria y cerramientos',
    0
  ),
  (
    'instalaciones eléctricas, sanitarias y de gas',
    'instalaciones electricas, sanitarias y de gas',
    0
  ),
  (
    'acabados (pisos, frisos, pintura y carpintería)',
    'acabados (pisos, frisos, pintura y carpinteria)',
    0
  ),
  (
    'impermeabilización y cubiertas',
    'impermeabilizacion y cubiertas',
    0
  ),
  (
    'asfaltado y obras de vialidad',
    'asfaltado y obras de vialidad',
    0
  )
on conflict (clave_norm) do nothing;

notify pgrst, 'reload schema';
