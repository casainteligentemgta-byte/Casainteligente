-- Varias fotos por egreso de campo (despacho web / Telegram).

alter table public.inv_egresos_campo
  add column if not exists fotos jsonb not null default '[]'::jsonb;

comment on column public.inv_egresos_campo.fotos is
  'Array JSON [{storage_path, url}] de fotos del material saliente.';

notify pgrst, 'reload schema';
