-- Formato fijo Telegram (un mensaje = un movimiento).
-- Idempotencia por chat_id + telegram_message_id y cola de pendientes de revisión.
-- Aditiva e idempotente. No se aplica sola: hay que correrla en SQL Editor.

create table if not exists public.ci_telegram_movimientos_formato (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  telegram_message_id bigint not null,
  telegram_date timestamptz not null,
  tipo text not null
    check (tipo in ('ingreso', 'salida', 'inventario')),
  estado text not null default 'procesando'
    check (estado in ('procesando', 'registrado', 'pendiente_revision', 'error')),
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  ubicacion_id uuid references public.inv_ubicaciones (id) on delete set null,
  num_doc text,
  proveedor_nombre text,
  destino_uso text,
  texto_original text not null default '',
  lineas jsonb not null default '[]'::jsonb,
  problemas jsonb not null default '[]'::jsonb,
  recepcion_campo_id uuid references public.ci_recepciones_campo (id) on delete set null,
  respuesta_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_ci_telegram_movimientos_formato_msg
  on public.ci_telegram_movimientos_formato (chat_id, telegram_message_id);

create index if not exists idx_ci_telegram_movimientos_formato_pendiente
  on public.ci_telegram_movimientos_formato (estado, created_at desc)
  where estado = 'pendiente_revision';

create index if not exists idx_ci_telegram_movimientos_formato_proyecto
  on public.ci_telegram_movimientos_formato (proyecto_id)
  where proyecto_id is not null;

comment on table public.ci_telegram_movimientos_formato is
  'Movimientos de almacén enviados en un solo mensaje por Telegram (formato fijo). Idempotencia chat+message_id; pendientes de revisión si el material no coincide o falta stock.';

alter table public.ci_telegram_movimientos_formato enable row level security;

revoke all on table public.ci_telegram_movimientos_formato from anon;
revoke all on table public.ci_telegram_movimientos_formato from public;
grant select on table public.ci_telegram_movimientos_formato to authenticated;
grant all on table public.ci_telegram_movimientos_formato to service_role;

drop policy if exists "ci_telegram_movimientos_formato_select_auth"
  on public.ci_telegram_movimientos_formato;

create policy "ci_telegram_movimientos_formato_select_auth"
  on public.ci_telegram_movimientos_formato
  for select to authenticated
  using (true);

notify pgrst, 'reload schema';
