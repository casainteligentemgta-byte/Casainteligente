-- Fase 2 RRHH: ofertas de plaza (banca) + campos de carnet digital.

-- ---------------------------------------------------------------------------
-- Ofertas de plaza (puerta banca → aceptación del obrero)
-- ---------------------------------------------------------------------------
create table if not exists public.ci_ofertas_plaza (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  empleado_id uuid not null references public.ci_empleados (id) on delete cascade,
  labor_request_id uuid null,
  proyecto_id uuid null references public.ci_proyectos (id) on delete set null,
  entidad_id uuid null,
  oficio_codigo text null,
  oficio_nombre text not null default '',
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada', 'caducada', 'asignada')),
  canal text not null default 'whatsapp',
  mensaje_enviado_at timestamptz null,
  respondido_at timestamptz null,
  notas text null,
  created_by uuid null
);

create index if not exists ci_ofertas_plaza_empleado_idx
  on public.ci_ofertas_plaza (empleado_id, created_at desc);
create index if not exists ci_ofertas_plaza_estado_idx
  on public.ci_ofertas_plaza (estado)
  where estado = 'pendiente';
create index if not exists ci_ofertas_plaza_proyecto_idx
  on public.ci_ofertas_plaza (proyecto_id);

comment on table public.ci_ofertas_plaza is
  'Ofertas de plaza desde banca RRHH. El obrero acepta/rechaza (WhatsApp u otro canal).';

-- ---------------------------------------------------------------------------
-- Carnet digital (emitido desde expediente / nómina)
-- ---------------------------------------------------------------------------
alter table public.ci_empleados
  add column if not exists carnet_codigo text,
  add column if not exists carnet_emitido_at timestamptz,
  add column if not exists carnet_vigente_hasta date;

comment on column public.ci_empleados.carnet_codigo is
  'Código corto del carnet digital del obrero (ej. CI-ASF-00421).';
comment on column public.ci_empleados.carnet_emitido_at is
  'Última emisión / reimpresión del carnet digital.';
comment on column public.ci_empleados.carnet_vigente_hasta is
  'Vigencia opcional del carnet (obra determinada / campaña).';

create unique index if not exists ci_empleados_carnet_codigo_uidx
  on public.ci_empleados (carnet_codigo)
  where carnet_codigo is not null and length(trim(carnet_codigo)) > 0;

notify pgrst, 'reload schema';
