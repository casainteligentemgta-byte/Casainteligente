-- Base de conocimiento legal (RAG) con embeddings OpenAI text-embedding-3-small (1536 dims).
-- Metadata tipada: categoria, tipo, jurisdiccion, fecha_vigencia, referencia.

create extension if not exists vector;

create table if not exists public.ci_legal_knowledge (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  -- Esquema canónico (también se guarda completo en metadata jsonb)
  categoria text not null default 'laboral'
    check (categoria in ('laboral', 'civil', 'internacional', 'mercantil')),
  tipo text not null default 'ley'
    check (tipo in ('ley', 'jurisprudencia', 'doctrina', 'contrato_modelo')),
  jurisdiccion text not null default 'venezuela'
    check (jurisdiccion in ('venezuela', 'internacional', 'extranjera')),
  fecha_vigencia date,
  referencia text,
  source text,
  capitulo text,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

comment on table public.ci_legal_knowledge is
  'Fragmentos legales con embedding para búsqueda semántica (Departamento Legal).';

comment on column public.ci_legal_knowledge.metadata is
  'JSON canónico: {categoria, tipo, jurisdiccion, fecha_vigencia, referencia, source?, capitulo?}';

create index if not exists idx_ci_legal_knowledge_source
  on public.ci_legal_knowledge (source);

create index if not exists idx_ci_legal_knowledge_capitulo
  on public.ci_legal_knowledge (capitulo);

create index if not exists idx_ci_legal_knowledge_categoria
  on public.ci_legal_knowledge (categoria);

create index if not exists idx_ci_legal_knowledge_tipo
  on public.ci_legal_knowledge (tipo);

create index if not exists idx_ci_legal_knowledge_jurisdiccion
  on public.ci_legal_knowledge (jurisdiccion);

create index if not exists idx_ci_legal_knowledge_referencia
  on public.ci_legal_knowledge (referencia);

create index if not exists idx_ci_legal_knowledge_metadata_gin
  on public.ci_legal_knowledge using gin (metadata jsonb_path_ops);

-- IVFFlat (recrear HNSW si el volumen crece mucho)
create index if not exists idx_ci_legal_knowledge_embedding_ivfflat
  on public.ci_legal_knowledge
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.ci_legal_knowledge enable row level security;

drop policy if exists ci_legal_knowledge_select_entitled on public.ci_legal_knowledge;
create policy ci_legal_knowledge_select_entitled
  on public.ci_legal_knowledge
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ci_legal_entitlements e
      where e.user_id = auth.uid()
        and e.activo = true
    )
  );

create or replace function public.match_ci_legal_knowledge(
  query_embedding vector(1536),
  match_count int default 8,
  filter_source text default null,
  filter_capitulo text default null,
  filter_categoria text default null,
  filter_tipo text default null,
  filter_jurisdiccion text default null,
  filter_referencia text default null
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  source text,
  capitulo text,
  categoria text,
  tipo text,
  jurisdiccion text,
  fecha_vigencia date,
  referencia text,
  similarity float
)
language sql
stable
as $$
  select
    k.id,
    k.content,
    k.metadata,
    k.source,
    k.capitulo,
    k.categoria,
    k.tipo,
    k.jurisdiccion,
    k.fecha_vigencia,
    k.referencia,
    (1 - (k.embedding <=> query_embedding))::float as similarity
  from public.ci_legal_knowledge k
  where k.embedding is not null
    and (filter_source is null or k.source = filter_source)
    and (filter_capitulo is null or k.capitulo = filter_capitulo)
    and (filter_categoria is null or k.categoria = filter_categoria)
    and (filter_tipo is null or k.tipo = filter_tipo)
    and (filter_jurisdiccion is null or k.jurisdiccion = filter_jurisdiccion)
    and (
      filter_referencia is null
      or k.referencia ilike '%' || filter_referencia || '%'
    )
  order by k.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 8), 50));
$$;

comment on function public.match_ci_legal_knowledge is
  'Top-K fragmentos legales por similitud coseno, con filtros de metadata.';

grant execute on function public.match_ci_legal_knowledge(
  vector, int, text, text, text, text, text, text
) to authenticated, service_role;

notify pgrst, 'reload schema';
