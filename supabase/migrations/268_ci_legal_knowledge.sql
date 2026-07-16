-- Base de conocimiento legal (RAG) con embeddings OpenAI text-embedding-3-small (1536 dims).
-- Fuente típica: "Obligaciones Legales del Empleador" y otros textos jurídicos.

create extension if not exists vector;

create table if not exists public.ci_legal_knowledge (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  source text,
  capitulo text,
  created_at timestamptz not null default now()
);

comment on table public.ci_legal_knowledge is
  'Fragmentos legales con embedding para búsqueda semántica (Departamento Legal).';

create index if not exists idx_ci_legal_knowledge_source
  on public.ci_legal_knowledge (source);

create index if not exists idx_ci_legal_knowledge_capitulo
  on public.ci_legal_knowledge (capitulo);

-- Índice IVFFlat (compatible; recrear HNSW si el volumen crece mucho)
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
  filter_capitulo text default null
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  source text,
  capitulo text,
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
    (1 - (k.embedding <=> query_embedding))::float as similarity
  from public.ci_legal_knowledge k
  where k.embedding is not null
    and (filter_source is null or k.source = filter_source)
    and (filter_capitulo is null or k.capitulo = filter_capitulo)
  order by k.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 8), 50));
$$;

comment on function public.match_ci_legal_knowledge is
  'Top-K fragmentos legales por similitud coseno (embedding query).';

grant execute on function public.match_ci_legal_knowledge(vector, int, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
