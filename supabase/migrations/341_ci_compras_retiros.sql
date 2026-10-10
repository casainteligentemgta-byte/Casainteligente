-- Retiro de mercancía comprada: quién la busca, con qué foto y cuándo llega al almacén.
--
-- Cierra el tramo entre «factura cargada por el comprador» y «recepción en almacén»:
--   pendiente → asignado (alguien dijo «la retiro yo») → en_camino (foto al retirar)
--   → entregado (el depositario registró el ingreso en /ingreso)
--
-- Una fila por factura. El bot solo crea retiros si esta tabla existe; sin la migración
-- el resto del flujo de compras funciona igual que antes.

create table if not exists public.ci_compras_retiros (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references public.purchase_invoices (id) on delete cascade,
  contabilidad_compra_id uuid references public.contabilidad_compras (id) on delete set null,
  procura_id uuid references public.ci_procuras (id) on delete set null,
  proyecto_id uuid references public.ci_proyectos (id) on delete set null,
  ubicacion_destino_id uuid references public.inv_ubicaciones (id) on delete set null,
  numero_factura text,
  proveedor_nombre text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'asignado', 'en_camino', 'entregado', 'cancelado')),
  solicitado_por_chat_id bigint,
  transportista_chat_id bigint,
  transportista_nombre text,
  fotos jsonb not null default '[]'::jsonb,
  asignado_at timestamptz,
  retirado_at timestamptz,
  entregado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_compras_retiros_factura_unique unique (purchase_invoice_id)
);

create index if not exists idx_ci_compras_retiros_proyecto_estado
  on public.ci_compras_retiros (proyecto_id, estado, created_at desc);

-- Búsqueda del retiro que espera foto de un transportista (bot).
create index if not exists idx_ci_compras_retiros_transportista_asignado
  on public.ci_compras_retiros (transportista_chat_id, asignado_at desc)
  where estado = 'asignado';

comment on table public.ci_compras_retiros is
  'Retiro de mercancía comprada (bot Telegram): quién la busca, foto al retirar y entrega en almacén.';
comment on column public.ci_compras_retiros.solicitado_por_chat_id is
  'Chat del comprador que cargó la factura; también puede retirarla él mismo.';
comment on column public.ci_compras_retiros.fotos is
  'Array JSON [{storage_path}] de fotos de la mercancía al retirarla (bucket procurement-documents).';

-- Solo el servidor (service role) escribe. La app con sesión puede consultar; sin sesión, nada.
alter table public.ci_compras_retiros enable row level security;

drop policy if exists "ci_compras_retiros_select_auth" on public.ci_compras_retiros;
create policy "ci_compras_retiros_select_auth" on public.ci_compras_retiros
  for select to authenticated using (true);

revoke all on public.ci_compras_retiros from anon;

notify pgrst, 'reload schema';
