-- Notas de entrega precargadas por el comprador (foto) para que el depositario de la obra
-- las confirme al ingresarlas. Mientras estén 'pendiente' NO hay stock ni RPC de ingreso.

create table if not exists public.ci_notas_precargadas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete restrict,
  proveedor_nombre text not null default '',
  proveedor_rif text null,
  num_doc varchar(120) not null default 'S/N',
  fecha date null,
  -- [{ descripcion, cantidad, unidad, material_id|null, item_code|null }]
  lineas jsonb not null default '[]'::jsonb,
  soporte_storage_path text null,
  soporte_file_name text null,
  soporte_mime_type text null,
  estado varchar(24) not null default 'pendiente'
    check (estado in ('pendiente', 'ingresada', 'anulada')),
  cargado_por_chat_id text null,
  cargado_por_label text null,
  recepcion_id uuid null references public.ci_recepciones_campo (id) on delete set null,
  ingresada_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ci_notas_precargadas_proyecto_estado_idx
  on public.ci_notas_precargadas (proyecto_id, estado, created_at desc);

alter table public.ci_notas_precargadas enable row level security;

drop policy if exists ci_notas_precargadas_authenticated on public.ci_notas_precargadas;
create policy ci_notas_precargadas_authenticated on public.ci_notas_precargadas
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
