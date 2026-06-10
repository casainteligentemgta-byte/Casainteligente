-- Marca ttl_pendiente de forma atómica (evita doble prompt por race en Telegram).

create or replace function public.ci_telegram_marcar_ttl_pendiente(p_chat_id text)
returns setof public.ci_telegram_estados
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.ci_telegram_estados
  set
    metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{ttl_pendiente}',
      'true'::jsonb,
      true
    ),
    updated_at = now()
  where chat_id = p_chat_id
    and contexto = 'procura_departamento'
    and (
      metadata->>'ttl_pendiente' is null
      or metadata->>'ttl_pendiente' = 'false'
    )
  returning *;
end;
$$;

comment on function public.ci_telegram_marcar_ttl_pendiente(text) is
  'UPDATE condicional: solo la primera petición concurrente marca ttl_pendiente en procura_departamento.';

grant execute on function public.ci_telegram_marcar_ttl_pendiente(text) to anon;
grant execute on function public.ci_telegram_marcar_ttl_pendiente(text) to authenticated;
grant execute on function public.ci_telegram_marcar_ttl_pendiente(text) to service_role;

notify pgrst, 'reload schema';
