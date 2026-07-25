-- RPC de búsqueda semántica alineada al cliente RAG:
-- match_legal_knowledge(query_embedding, match_threshold, match_count, filter_metadata)

create or replace function public.match_legal_knowledge(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_metadata jsonb default null
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
    and (1 - (k.embedding <=> query_embedding)) >= coalesce(match_threshold, 0.7)
    and (
      filter_metadata is null
      or (
        (not (filter_metadata ? 'categoria') or k.categoria = filter_metadata->>'categoria')
        and (not (filter_metadata ? 'tipo') or k.tipo = filter_metadata->>'tipo')
        and (not (filter_metadata ? 'jurisdiccion') or k.jurisdiccion = filter_metadata->>'jurisdiccion')
        and (
          not (filter_metadata ? 'referencia')
          or k.referencia ilike '%' || (filter_metadata->>'referencia') || '%'
        )
        and (
          not (filter_metadata ? 'source')
          or k.source = filter_metadata->>'source'
        )
        and (
          not (filter_metadata ? 'capitulo')
          or k.capitulo = filter_metadata->>'capitulo'
        )
        -- Cualquier otra clave se aplica contra el jsonb metadata
        and k.metadata @> (
          filter_metadata
          - 'categoria' - 'tipo' - 'jurisdiccion'
          - 'referencia' - 'source' - 'capitulo'
        )
      )
    )
  order by k.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 5), 50));
$$;

comment on function public.match_legal_knowledge is
  'Top-K fragmentos legales por similitud coseno con umbral y filter_metadata JSON.';

grant execute on function public.match_legal_knowledge(
  vector, float, int, jsonb
) to authenticated, service_role;

-- Reemplaza la firma de 268 y añade umbral opcional
drop function if exists public.match_ci_legal_knowledge(
  vector, int, text, text, text, text, text, text
);

create or replace function public.match_ci_legal_knowledge(
  query_embedding vector(1536),
  match_count int default 8,
  filter_source text default null,
  filter_capitulo text default null,
  filter_categoria text default null,
  filter_tipo text default null,
  filter_jurisdiccion text default null,
  filter_referencia text default null,
  match_threshold float default 0.0
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
  select *
  from public.match_legal_knowledge(
    query_embedding,
    coalesce(match_threshold, 0.0),
    coalesce(match_count, 8),
    jsonb_strip_nulls(
      jsonb_build_object(
        'categoria', filter_categoria,
        'tipo', filter_tipo,
        'jurisdiccion', filter_jurisdiccion,
        'referencia', filter_referencia,
        'source', filter_source,
        'capitulo', filter_capitulo
      )
    )
  );
$$;

grant execute on function public.match_ci_legal_knowledge(
  vector, int, text, text, text, text, text, text, float
) to authenticated, service_role;

notify pgrst, 'reload schema';
