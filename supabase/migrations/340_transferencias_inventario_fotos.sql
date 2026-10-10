-- Foto del material en traspasos / préstamos entre almacenes (bot /salida → Traspaso).
-- Mismo formato que inv_egresos_campo.fotos (migración 208).
--
-- El bot funciona aunque esta migración no esté aplicada: en ese caso deja la ruta
-- de la foto en transferencias_inventario.observaciones.

alter table public.transferencias_inventario
  add column if not exists fotos jsonb not null default '[]'::jsonb;

comment on column public.transferencias_inventario.fotos is
  'Array JSON [{storage_path, url}] de fotos del material traspasado.';

notify pgrst, 'reload schema';
