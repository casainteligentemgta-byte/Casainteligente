-- Migración 297 (antes 293 en PR #166; 293 ya es psique en main).
-- Pheme: reuniones, análisis estructurado y embeddings (pgvector).
-- Bucket privado: reuniones-audio
-- Embedding model: OpenAI text-embedding-3-small (1536 dims)
-- Idempotente: si `reuniones` ya existía con otro esquema, añade columnas faltantes.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- reuniones (crear si no existe + alinear columnas)
-- ---------------------------------------------------------------------------
create table if not exists public.reuniones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  titulo text not null default 'Reunión sin título',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reuniones
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists titulo text not null default 'Reunión sin título',
  add column if not exists audio_path text,
  add column if not exists audio_bucket text not null default 'reuniones-audio',
  add column if not exists mime_type text,
  add column if not exists file_name text,
  add column if not exists file_size_bytes bigint,
  add column if not exists duracion_segundos integer,
  add column if not exists estado text not null default 'pendiente',
  add column if not exists transcripcion_raw text,
  add column if not exists stt_provider text,
  add column if not exists stt_model text,
  add column if not exists error_message text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- CHECK de estado (solo si no existe ya una constraint equivalente)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reuniones_estado_check'
      and conrelid = 'public.reuniones'::regclass
  ) then
    alter table public.reuniones
      add constraint reuniones_estado_check
      check (estado in (
        'pendiente',
        'subida',
        'transcribiendo',
        'analizando',
        'indexando',
        'listo',
        'error'
      ));
  end if;
exception
  when duplicate_object then null;
end;
$$;

comment on table public.reuniones is
  'Grabaciones de reuniones estratégicas vinculadas al usuario (agente Pheme).';

comment on column public.reuniones.transcripcion_raw is
  'Texto STT con diarización de hablantes cuando esté disponible.';

create index if not exists idx_reuniones_user_id_created
  on public.reuniones (user_id, created_at desc);

create index if not exists idx_reuniones_estado
  on public.reuniones (estado);

create or replace function public.reuniones_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reuniones_updated_at on public.reuniones;
create trigger trg_reuniones_updated_at
  before update on public.reuniones
  for each row
  execute function public.reuniones_set_updated_at();

alter table public.reuniones enable row level security;

drop policy if exists reuniones_select_own on public.reuniones;
create policy reuniones_select_own
  on public.reuniones for select to authenticated
  using (user_id = auth.uid());

drop policy if exists reuniones_insert_own on public.reuniones;
create policy reuniones_insert_own
  on public.reuniones for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists reuniones_update_own on public.reuniones;
create policy reuniones_update_own
  on public.reuniones for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists reuniones_delete_own on public.reuniones;
create policy reuniones_delete_own
  on public.reuniones for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.reuniones to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pheme_analisis
-- ---------------------------------------------------------------------------
create table if not exists public.pheme_analisis (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid references public.reuniones (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.pheme_analisis
  add column if not exists reunion_id uuid references public.reuniones (id) on delete cascade,
  add column if not exists resumen_ejecutivo jsonb not null default '{}'::jsonb,
  add column if not exists matriz_viabilidad jsonb not null default '{}'::jsonb,
  add column if not exists mapa_mental_mermaid text not null default '',
  add column if not exists analisis_comunicacion jsonb not null default '{}'::jsonb,
  add column if not exists modelo text,
  add column if not exists raw_response jsonb,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pheme_analisis_reunion_id_key'
      and conrelid = 'public.pheme_analisis'::regclass
  ) then
    alter table public.pheme_analisis
      add constraint pheme_analisis_reunion_id_key unique (reunion_id);
  end if;
exception when others then
  raise notice 'unique pheme_analisis.reunion_id omitido: %', SQLERRM;
end;
$$;

comment on table public.pheme_analisis is
  'Informe JSON estructurado del agente Pheme por reunión.';

create index if not exists idx_pheme_analisis_reunion_id
  on public.pheme_analisis (reunion_id);

alter table public.pheme_analisis enable row level security;

drop policy if exists pheme_analisis_select_own on public.pheme_analisis;
create policy pheme_analisis_select_own
  on public.pheme_analisis for select to authenticated
  using (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  );

drop policy if exists pheme_analisis_insert_own on public.pheme_analisis;
create policy pheme_analisis_insert_own
  on public.pheme_analisis for insert to authenticated
  with check (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  );

drop policy if exists pheme_analisis_update_own on public.pheme_analisis;
create policy pheme_analisis_update_own
  on public.pheme_analisis for update to authenticated
  using (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  );

drop policy if exists pheme_analisis_delete_own on public.pheme_analisis;
create policy pheme_analisis_delete_own
  on public.pheme_analisis for delete to authenticated
  using (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.pheme_analisis to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pheme_embeddings
-- ---------------------------------------------------------------------------
create table if not exists public.pheme_embeddings (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid references public.reuniones (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.pheme_embeddings
  add column if not exists reunion_id uuid references public.reuniones (id) on delete cascade,
  add column if not exists chunk_index integer not null default 0,
  add column if not exists content text not null default '',
  add column if not exists embedding vector(1536),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pheme_embeddings_reunion_id_chunk_index_key'
      and conrelid = 'public.pheme_embeddings'::regclass
  ) then
    alter table public.pheme_embeddings
      add constraint pheme_embeddings_reunion_id_chunk_index_key
      unique (reunion_id, chunk_index);
  end if;
exception when others then
  raise notice 'unique pheme_embeddings (reunion_id, chunk_index) omitido: %', SQLERRM;
end;
$$;

comment on table public.pheme_embeddings is
  'Chunks de transcripción (~500 palabras) con embeddings text-embedding-3-small.';

create index if not exists idx_pheme_embeddings_reunion_id
  on public.pheme_embeddings (reunion_id);

-- IVFFlat solo si aún no existe (puede fallar en tablas vacías en algunas versiones)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_pheme_embeddings_embedding_ivfflat'
  ) then
    create index idx_pheme_embeddings_embedding_ivfflat
      on public.pheme_embeddings
      using ivfflat (embedding vector_cosine_ops)
      with (lists = 100);
  end if;
exception
  when others then
    raise notice 'Índice ivfflat omitido (se puede crear después de haber filas): %', SQLERRM;
end;
$$;

alter table public.pheme_embeddings enable row level security;

drop policy if exists pheme_embeddings_select_own on public.pheme_embeddings;
create policy pheme_embeddings_select_own
  on public.pheme_embeddings for select to authenticated
  using (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  );

drop policy if exists pheme_embeddings_insert_own on public.pheme_embeddings;
create policy pheme_embeddings_insert_own
  on public.pheme_embeddings for insert to authenticated
  with check (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  );

drop policy if exists pheme_embeddings_update_own on public.pheme_embeddings;
create policy pheme_embeddings_update_own
  on public.pheme_embeddings for update to authenticated
  using (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  );

drop policy if exists pheme_embeddings_delete_own on public.pheme_embeddings;
create policy pheme_embeddings_delete_own
  on public.pheme_embeddings for delete to authenticated
  using (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.pheme_embeddings to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC búsqueda semántica
-- ---------------------------------------------------------------------------
create or replace function public.match_pheme_embeddings(
  query_embedding vector(1536),
  match_threshold float default 0.65,
  match_count int default 8,
  filter_reunion_id uuid default null
)
returns table (
  id uuid,
  reunion_id uuid,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security invoker
as $$
  select
    e.id,
    e.reunion_id,
    e.chunk_index,
    e.content,
    e.metadata,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from public.pheme_embeddings e
  inner join public.reuniones r on r.id = e.reunion_id
  where e.embedding is not null
    and r.user_id = auth.uid()
    and (filter_reunion_id is null or e.reunion_id = filter_reunion_id)
    and (1 - (e.embedding <=> query_embedding)) >= coalesce(match_threshold, 0.65)
  order by e.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 8), 50));
$$;

comment on function public.match_pheme_embeddings is
  'Top-K chunks Pheme por similitud coseno, filtrados al usuario autenticado.';

grant execute on function public.match_pheme_embeddings(vector, float, int, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket reuniones-audio (privado)
-- Path canónico: {user_id}/{reunion_id}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('reuniones-audio', 'reuniones-audio', false)
on conflict (id) do nothing;

drop policy if exists reuniones_audio_select_own on storage.objects;
create policy reuniones_audio_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reuniones-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists reuniones_audio_insert_own on storage.objects;
create policy reuniones_audio_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reuniones-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists reuniones_audio_update_own on storage.objects;
create policy reuniones_audio_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'reuniones-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'reuniones-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists reuniones_audio_delete_own on storage.objects;
create policy reuniones_audio_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'reuniones-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
