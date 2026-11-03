-- Contacto Telegram en el CRM y conteo de obras por cliente (lista /clientes).
-- No se aplica sola en producción: hay que correrla en SQL Editor cuando se decida.

alter table public.customers
  add column if not exists telegram_username text,
  add column if not exists telegram_chat_id bigint;

comment on column public.customers.telegram_username is
  'Usuario de Telegram sin @ (abre t.me/<username> en la ficha).';
comment on column public.customers.telegram_chat_id is
  'Chat id numérico del bot, si se enlaza después.';

create index if not exists idx_customers_telegram_username
  on public.customers (lower(telegram_username))
  where telegram_username is not null and btrim(telegram_username) <> '';

-- Una lectura agrupada: cuántas obras tiene cada cliente (evita select * de ci_proyectos).
create or replace function public.ci_conteo_obras_por_cliente(p_ids uuid[])
returns table(customer_id uuid, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.customer_id, count(*)::bigint as n
  from public.ci_proyectos p
  where p.customer_id = any (p_ids)
  group by p.customer_id;
$$;

comment on function public.ci_conteo_obras_por_cliente(uuid[]) is
  'Conteo de obras (ci_proyectos) por customer_id. Invoker: pasa por RLS.';

revoke all on function public.ci_conteo_obras_por_cliente(uuid[]) from public, anon;
grant execute on function public.ci_conteo_obras_por_cliente(uuid[]) to authenticated;

notify pgrst, 'reload schema';
