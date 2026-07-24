-- Nombre legible de quien solicita la procura (Telegram, web o empleado vinculado).

alter table public.ci_procuras
  add column if not exists solicitante_nombre text;

comment on column public.ci_procuras.solicitante_nombre is
  'Nombre de quien realiza la solicitud de procura (snapshot al crear).';

update public.ci_procuras p
set solicitante_nombre = coalesce(
  nullif(btrim(e.nombre_completo), ''),
  nullif(btrim(e.nombres || ' ' || coalesce(e.primer_apellido, '')), '')
)
from public.ci_empleados e
where p.solicitante_empleado_id = e.id
  and (p.solicitante_nombre is null or btrim(p.solicitante_nombre) = '');

update public.ci_procuras p
set solicitante_nombre = w.nombre
from public.ci_telegram_whitelist w
where p.solicitante_telegram_chat_id = w.chat_id
  and w.activo = true
  and (p.solicitante_nombre is null or btrim(p.solicitante_nombre) = '')
  and nullif(btrim(w.nombre), '') is not null;

notify pgrst, 'reload schema';
