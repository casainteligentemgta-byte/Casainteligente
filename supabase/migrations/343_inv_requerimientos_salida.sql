-- Requerimiento de salida de almacén: el ingeniero pide, el almacén despacha con foto.
--
--   solicitado → en_despacho (alguien del almacén lo tomó) → despachado (foto + stock movido)
--                                                          ↘ rechazado
--
-- Cinco motivos de salida. Los tres últimos sacan el material del inventario disponible:
--   uso         material que se consume en la obra
--   colocacion  material que queda instalado en la obra
--   traspaso    va al inventario de otra obra
--   devolucion  vuelve al proveedor        → ubicación virtual DEVOLUCIONES
--   deterioro   dañado, vencido o perdido  → ubicación virtual BAJAS
--
-- El bot solo ofrece «Pedir material al almacén» si esta tabla existe.

create table if not exists public.inv_requerimientos_salida (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  origen_ubicacion_id uuid not null references public.inv_ubicaciones (id) on delete restrict,
  destino_ubicacion_id uuid references public.inv_ubicaciones (id) on delete set null,
  tipo text not null
    check (tipo in ('uso', 'colocacion', 'traspaso', 'devolucion', 'deterioro')),
  material_id uuid not null references public.global_inventory (id) on delete restrict,
  material_nombre text not null,
  unidad text not null default 'UND',
  cantidad numeric(15, 4) not null check (cantidad > 0),
  motivo text,
  estado text not null default 'solicitado'
    check (estado in ('solicitado', 'en_despacho', 'despachado', 'rechazado', 'cancelado')),
  solicitante_chat_id bigint,
  solicitante_nombre text,
  despachador_chat_id bigint,
  despachador_nombre text,
  motivo_rechazo text,
  fotos jsonb not null default '[]'::jsonb,
  transferencia_id uuid references public.transferencias_inventario (id) on delete set null,
  tomado_at timestamptz,
  despachado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inv_requerimientos_salida_codigo_unique unique (codigo),
  constraint inv_requerimientos_salida_traspaso_destino check (
    tipo <> 'traspaso' or destino_ubicacion_id is not null
  )
);

create index if not exists idx_inv_requerimientos_salida_proyecto_estado
  on public.inv_requerimientos_salida (proyecto_id, estado, created_at desc);

-- Búsqueda del requerimiento que espera foto de quien despacha (bot).
create index if not exists idx_inv_requerimientos_salida_despachador
  on public.inv_requerimientos_salida (despachador_chat_id, tomado_at desc)
  where estado = 'en_despacho';

comment on table public.inv_requerimientos_salida is
  'Requerimiento de salida de almacén (bot Telegram): quién pide, para qué, quién despacha y con qué foto.';
comment on column public.inv_requerimientos_salida.fotos is
  'Array JSON [{storage_path, url}] de fotos del material al despacharlo.';

-- Solo el servidor (service role) escribe. La app con sesión puede consultar.
alter table public.inv_requerimientos_salida enable row level security;

drop policy if exists "inv_requerimientos_salida_select_auth" on public.inv_requerimientos_salida;
create policy "inv_requerimientos_salida_select_auth" on public.inv_requerimientos_salida
  for select to authenticated using (true);

-- Sin acceso anónimo: nadie sin sesión lee ni escribe requerimientos.
revoke all on public.inv_requerimientos_salida from anon;

-- Ubicaciones virtuales para lo que sale del inventario disponible. Mismo tipo que
-- GARANTIAS (migración 180): no aparecen como almacén de origen ni de destino.
insert into public.inv_ubicaciones (codigo, nombre, tipo)
select v.codigo, v.nombre, 'garantias'
from (
  values
    ('DEVOLUCIONES', 'Almacén virtual — Devoluciones a proveedor'),
    ('BAJAS', 'Almacén virtual — Deterioro y bajas')
) as v (codigo, nombre)
where not exists (
  select 1 from public.inv_ubicaciones u where u.codigo = v.codigo
);

notify pgrst, 'reload schema';
