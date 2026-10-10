-- Despacho de una procura desde el almacén con foto obligatoria.
-- El depositario pulsa «Confirmar» (toma el despacho) y el material sale cuando envía la foto.

alter table public.ci_procuras
  add column if not exists despacho_chat_id bigint,
  add column if not exists despacho_tomado_at timestamptz;

comment on column public.ci_procuras.despacho_chat_id is
  'Chat de Telegram de quien tomó el despacho de almacén y debe enviar la foto del material.';
comment on column public.ci_procuras.despacho_tomado_at is
  'Momento en que se tomó el despacho; se limpia al registrar la foto o al soltarlo.';

create index if not exists ci_procuras_despacho_chat_idx
  on public.ci_procuras (despacho_chat_id)
  where despacho_chat_id is not null;
