-- Verificación post-migración 288 (Pheme). Pegar en SQL Editor y revisar la columna ok.
select
  check_name,
  ok,
  detail
from (
  select
    'extension_vector' as check_name,
    exists (select 1 from pg_extension where extname = 'vector') as ok,
    coalesce(
      (select extversion from pg_extension where extname = 'vector'),
      'no instalada'
    ) as detail

  union all
  select
    'table_reuniones',
    to_regclass('public.reuniones') is not null,
    coalesce(to_regclass('public.reuniones')::text, 'faltante')

  union all
  select
    'col_reuniones_transcripcion_raw',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'reuniones'
        and column_name = 'transcripcion_raw'
    ),
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'reuniones'
        and column_name = 'transcripcion_raw'
    ) then 'presente' else 'faltante' end

  union all
  select
    'cols_reuniones_pheme',
    (
      select count(*) = 14
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'reuniones'
        and column_name in (
          'user_id', 'titulo', 'audio_path', 'audio_bucket', 'mime_type',
          'file_name', 'file_size_bytes', 'duracion_segundos', 'estado',
          'transcripcion_raw', 'stt_provider', 'stt_model', 'error_message', 'metadata'
        )
    ),
    (
      select string_agg(column_name, ', ' order by column_name)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'reuniones'
        and column_name in (
          'user_id', 'titulo', 'audio_path', 'audio_bucket', 'mime_type',
          'file_name', 'file_size_bytes', 'duracion_segundos', 'estado',
          'transcripcion_raw', 'stt_provider', 'stt_model', 'error_message', 'metadata'
        )
    )

  union all
  select
    'table_pheme_analisis',
    to_regclass('public.pheme_analisis') is not null,
    coalesce(to_regclass('public.pheme_analisis')::text, 'faltante')

  union all
  select
    'table_pheme_embeddings',
    to_regclass('public.pheme_embeddings') is not null,
    coalesce(to_regclass('public.pheme_embeddings')::text, 'faltante')

  union all
  select
    'rpc_match_pheme_embeddings',
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'match_pheme_embeddings'
    ),
    case when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'match_pheme_embeddings'
    ) then 'presente' else 'faltante' end

  union all
  select
    'bucket_reuniones_audio',
    exists (select 1 from storage.buckets where id = 'reuniones-audio'),
    case when exists (select 1 from storage.buckets where id = 'reuniones-audio')
      then 'presente' else 'faltante' end

  union all
  select
    'rls_reuniones',
    coalesce(
      (select relrowsecurity from pg_class where oid = 'public.reuniones'::regclass),
      false
    ),
    case when coalesce(
      (select relrowsecurity from pg_class where oid = 'public.reuniones'::regclass),
      false
    ) then 'activado' else 'desactivado/faltante' end

  union all
  select
    'storage_policies_reuniones_audio',
    (
      select count(*) >= 4
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname like 'reuniones_audio_%'
    ),
    (
      select coalesce(string_agg(policyname, ', ' order by policyname), 'ninguna')
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname like 'reuniones_audio_%'
    )
) t
order by check_name;
