-- Cuentas por pagar: pagos de facturas a crédito.
-- El status de purchase_invoices (PENDIENTE/REGISTRADA/COMPLETADO) es de flujo/inventario, no de pago.

begin;

create table if not exists public.contabilidad_credito_pagos (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references public.purchase_invoices (id) on delete cascade,
  contabilidad_compra_id uuid references public.contabilidad_compras (id) on delete set null,
  monto_usd numeric(15, 2) not null check (monto_usd > 0),
  fecha_pago date not null default (timezone('America/Caracas', now()))::date,
  pagado_por_nombre text,
  pagado_por_telegram_chat_id bigint,
  pagado_por_user_id uuid,
  referencia text,
  comprobante_storage_path text,
  comprobante_file_name text,
  comprobante_mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_contabilidad_credito_pagos_factura
  on public.contabilidad_credito_pagos (purchase_invoice_id, created_at desc);

create index if not exists idx_contabilidad_credito_pagos_compra
  on public.contabilidad_credito_pagos (contabilidad_compra_id)
  where contabilidad_compra_id is not null;

comment on table public.contabilidad_credito_pagos is
  'Abonos y pagos de compras a crédito (cuentas por pagar). No usa purchase_invoices.status.';

-- Dedupe diario de recordatorios (3 días antes, vencimiento, vencido).
create table if not exists public.contabilidad_credito_recordatorios (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references public.purchase_invoices (id) on delete cascade,
  tipo text not null check (tipo in ('3_dias', 'vencimiento', 'vencido')),
  enviado_el date not null,
  chat_id text not null,
  created_at timestamptz not null default now(),
  constraint contabilidad_credito_recordatorios_unico
    unique (purchase_invoice_id, tipo, enviado_el, chat_id)
);

create index if not exists idx_contabilidad_credito_recordatorios_dia
  on public.contabilidad_credito_recordatorios (enviado_el, tipo);

comment on table public.contabilidad_credito_recordatorios is
  'Log de avisos Telegram de vencimiento de crédito; evita duplicar el mismo aviso el mismo día.';

alter table public.contabilidad_credito_pagos enable row level security;
alter table public.contabilidad_credito_recordatorios enable row level security;

drop policy if exists contabilidad_credito_pagos_select_auth on public.contabilidad_credito_pagos;
create policy contabilidad_credito_pagos_select_auth
  on public.contabilidad_credito_pagos for select to authenticated
  using (true);

drop policy if exists contabilidad_credito_pagos_insert_auth on public.contabilidad_credito_pagos;
create policy contabilidad_credito_pagos_insert_auth
  on public.contabilidad_credito_pagos for insert to authenticated
  with check (true);

drop policy if exists contabilidad_credito_recordatorios_select_auth on public.contabilidad_credito_recordatorios;
create policy contabilidad_credito_recordatorios_select_auth
  on public.contabilidad_credito_recordatorios for select to authenticated
  using (true);

drop policy if exists contabilidad_credito_recordatorios_insert_auth on public.contabilidad_credito_recordatorios;
create policy contabilidad_credito_recordatorios_insert_auth
  on public.contabilidad_credito_recordatorios for insert to authenticated
  with check (true);

revoke all on table public.contabilidad_credito_pagos from anon;
revoke all on table public.contabilidad_credito_recordatorios from anon;

-- Comprobantes privados (foto/PDF). El bot y las rutas API suben con service role.
insert into storage.buckets (id, name, public)
values ('credito-comprobantes', 'credito-comprobantes', false)
on conflict (id) do update set public = false;

drop policy if exists credito_comprobantes_select_auth on storage.objects;
create policy credito_comprobantes_select_auth
  on storage.objects for select to authenticated
  using (bucket_id = 'credito-comprobantes');

drop policy if exists credito_comprobantes_insert_auth on storage.objects;
create policy credito_comprobantes_insert_auth
  on storage.objects for insert to authenticated
  with check (bucket_id = 'credito-comprobantes');

drop policy if exists credito_comprobantes_update_auth on storage.objects;
create policy credito_comprobantes_update_auth
  on storage.objects for update to authenticated
  using (bucket_id = 'credito-comprobantes')
  with check (bucket_id = 'credito-comprobantes');

-- Matriz de permisos (si 376 ya corrió). No falla si la tabla no existe.
insert into public.ci_rol_permisos (rol, permiso)
select x.rol::public.ci_rol_sistema, 'compra.credito_pagar'
from (values
  ('super_admin'),
  ('entidad_admin'),
  ('contador'),
  ('comprador')
) as x(rol)
where to_regclass('public.ci_rol_permisos') is not null
on conflict do nothing;

-- Flujo Telegram /credito (comprobante / confirmación).
alter table public.ci_telegram_estados drop constraint if exists ci_telegram_estados_contexto_check;
alter table public.ci_telegram_estados
  add constraint ci_telegram_estados_contexto_check
  check (contexto = any (array[
    'menu'::text,
    'factura'::text,
    'obra'::text,
    'gasto_obra'::text,
    'esperando_audio_bitacora'::text,
    'entrada_obra'::text,
    'nota_precarga'::text,
    'resolver_lineas'::text,
    'salida_obra'::text,
    'avance_campo'::text,
    'avance_campo_cantidad'::text,
    'memoria_obra'::text,
    'memoria_obra_foto'::text,
    'depositario_recepcion'::text,
    'traspaso_inventario'::text,
    'merma_almacen'::text,
    'consulta_stock'::text,
    'procura_solicitud'::text,
    'procura_departamento'::text,
    'esperando_motivo_rechazo'::text,
    'agenda'::text,
    'credito_pago'::text
  ]));

notify pgrst, 'reload schema';

commit;
