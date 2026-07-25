-- Fusión CCO V4 → Casa Inteligente.
-- Contratos de subcontratista (distintos de AD en ci_contratos_express),
-- catálogos de estructura/tipos, presupuestos por capítulo, config de obra,
-- auditoría append-only y columnas CCO en contabilidad_compras.

-- ─── Config por obra (equivalente a .session_metadata.json) ───
create table if not exists public.cco_proyecto_config (
  proyecto_id uuid primary key references public.ci_proyectos (id) on delete cascade,
  honorarios_admin_pct numeric(5, 2) not null default 15
    check (honorarios_admin_pct >= 0 and honorarios_admin_pct <= 100),
  devaluacion_pct numeric(8, 4) not null default 0,
  empresa_nombre text,
  obra_alias text,
  area_m2 numeric(14, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cco_proyecto_config is
  'Config CCO V4 por obra: % admin global, devaluación, alias. No reemplaza AD en ci_contratos_express.';

-- ─── Catálogo estructura de costos (capítulo / subcapítulo) ───
create table if not exists public.cco_estructura_costos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.ci_proyectos (id) on delete cascade,
  nombre text not null,
  tipo_nivel text not null check (tipo_nivel in ('CAPITULO', 'SUBCAPITULO')),
  padre_id uuid references public.cco_estructura_costos (id) on delete cascade,
  origen_v4_id integer,
  created_at timestamptz not null default now(),
  unique (proyecto_id, origen_v4_id)
);

create index if not exists idx_cco_estructura_proyecto
  on public.cco_estructura_costos (proyecto_id, tipo_nivel);

comment on table public.cco_estructura_costos is
  'Capítulos/subcapítulos CCO (import V4 estructura_costos). proyecto_id null = catálogo global.';

-- ─── Contratos de subcontratista (CLASE=CONTRATO en V4) ───
create table if not exists public.cco_contratos_obra (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  proveedor text not null,
  descripcion text not null,
  fecha date,
  moneda text not null default 'USD',
  monto_base_usd numeric(18, 4) not null default 0 check (monto_base_usd >= 0),
  admin_pct numeric(5, 2) not null default 15
    check (admin_pct >= 0 and admin_pct <= 100),
  honorarios_usd numeric(18, 4) not null default 0,
  costo_total_usd numeric(18, 4) not null default 0,
  estado text not null default 'PENDIENTE',
  tipo_gasto_cco text,
  origen_v4_id integer,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, origen_v4_id)
);

create index if not exists idx_cco_contratos_obra_proyecto
  on public.cco_contratos_obra (proyecto_id, proveedor);

create index if not exists idx_cco_contratos_obra_proveedor
  on public.cco_contratos_obra (proyecto_id, lower(proveedor));

comment on table public.cco_contratos_obra is
  'Contratos padre CCO V4 (subcontratista). Distinto de ci_contratos_express (AD/obreros).';

-- ─── Presupuestos por capítulo (CLASE=PRESUPUESTO) ───
create table if not exists public.cco_presupuestos_capitulo (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  capitulo text not null,
  subcapitulo text,
  descripcion text,
  estimado_usd numeric(18, 4) not null default 0,
  estructura_id uuid references public.cco_estructura_costos (id) on delete set null,
  origen_v4_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, origen_v4_id)
);

create index if not exists idx_cco_presupuestos_proyecto
  on public.cco_presupuestos_capitulo (proyecto_id, capitulo);

-- ─── Auditoría append-only (CLASE=AUDITORIA) ───
create table if not exists public.cco_auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  fecha timestamptz not null default now(),
  accion text not null,
  detalle text,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  origen_v4_id integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_cco_auditoria_proyecto_fecha
  on public.cco_auditoria_eventos (proyecto_id, fecha desc);

-- ─── Enriquecer compras (GASTO) ───
alter table public.contabilidad_compras
  add column if not exists tipo_gasto_cco text,
  add column if not exists contrato_obra_id uuid references public.cco_contratos_obra (id) on delete set null,
  add column if not exists admin_pct_override numeric(5, 2)
    check (admin_pct_override is null or (admin_pct_override >= 0 and admin_pct_override <= 100)),
  add column if not exists honorarios_usd numeric(18, 4),
  add column if not exists capitulo_cco text,
  add column if not exists subcapitulo_cco text,
  add column if not exists estructura_capitulo_id uuid references public.cco_estructura_costos (id) on delete set null,
  add column if not exists estructura_subcapitulo_id uuid references public.cco_estructura_costos (id) on delete set null,
  add column if not exists tasa_binance numeric(18, 6),
  add column if not exists tasa_usada text,
  add column if not exists porcentaje_brecha_real numeric(10, 4),
  add column if not exists forma_pago_cco text,
  add column if not exists origen_v4_id integer,
  add column if not exists cco_estado text;

comment on column public.contabilidad_compras.tipo_gasto_cco is
  'Tipo CCO V4 (MATERIALES, CONTRATISTA, …). Heurística solo como default al importar.';
comment on column public.contabilidad_compras.contrato_obra_id is
  'CONTRATO_VINCULADO → cco_contratos_obra (pagos a subcontratista).';

create index if not exists idx_contabilidad_compras_contrato_obra
  on public.contabilidad_compras (contrato_obra_id)
  where contrato_obra_id is not null;

create unique index if not exists uq_contabilidad_compras_origen_v4
  on public.contabilidad_compras (proyecto_id, origen_v4_id)
  where origen_v4_id is not null and proyecto_id is not null;

-- ─── RLS (mismo patrón abierto anon de módulos contables CI) ───
alter table public.cco_proyecto_config enable row level security;
alter table public.cco_estructura_costos enable row level security;
alter table public.cco_contratos_obra enable row level security;
alter table public.cco_presupuestos_capitulo enable row level security;
alter table public.cco_auditoria_eventos enable row level security;

drop policy if exists "cco_proyecto_config_all_anon" on public.cco_proyecto_config;
create policy "cco_proyecto_config_all_anon" on public.cco_proyecto_config
  for all to anon using (true) with check (true);

drop policy if exists "cco_estructura_costos_all_anon" on public.cco_estructura_costos;
create policy "cco_estructura_costos_all_anon" on public.cco_estructura_costos
  for all to anon using (true) with check (true);

drop policy if exists "cco_contratos_obra_all_anon" on public.cco_contratos_obra;
create policy "cco_contratos_obra_all_anon" on public.cco_contratos_obra
  for all to anon using (true) with check (true);

drop policy if exists "cco_presupuestos_capitulo_all_anon" on public.cco_presupuestos_capitulo;
create policy "cco_presupuestos_capitulo_all_anon" on public.cco_presupuestos_capitulo
  for all to anon using (true) with check (true);

drop policy if exists "cco_auditoria_eventos_all_anon" on public.cco_auditoria_eventos;
create policy "cco_auditoria_eventos_all_anon" on public.cco_auditoria_eventos
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.cco_proyecto_config to anon, authenticated, service_role;
grant select, insert, update, delete on public.cco_estructura_costos to anon, authenticated, service_role;
grant select, insert, update, delete on public.cco_contratos_obra to anon, authenticated, service_role;
grant select, insert, update, delete on public.cco_presupuestos_capitulo to anon, authenticated, service_role;
grant select, insert, update, delete on public.cco_auditoria_eventos to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- --- antes 269_match_legal_knowledge.sql ---

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
