-- 372: facturas únicas por RIF + número (normalizados) e historial de cambios.
--
-- 1) Comprobación previa: si ya hay duplicados, la migración se detiene y no crea nada.
-- 2) Índice único en purchase_invoices.
-- 3) Índice único en ci_facturas_canal_pendientes (estado distinto de 'error', para que
--    una extracción fallida no bloquee una nueva carga de la misma factura).
-- 4) Tabla de historial de cambios de facturas (origen: telegram o web).
--
-- Nota: el duplicado ya no depende de una comprobación previa en la app. La base lo
-- rechaza con 23505 y la app debe capturarlo (fase 2). Aplicar esta migración junto
-- con el despliegue de la fase 2.

do $$
declare
  n integer;
begin
  select count(*) into n
  from (
    select 1
    from purchase_invoices
    where coalesce(supplier_rif, '') <> '' and coalesce(invoice_number, '') <> ''
    group by
      upper(regexp_replace(supplier_rif, '[^A-Za-z0-9]', '', 'g')),
      upper(regexp_replace(invoice_number, '[^A-Za-z0-9]', '', 'g'))
    having count(*) > 1
  ) d;
  if n > 0 then
    raise exception 'Hay % grupo(s) de facturas duplicadas en purchase_invoices; resolver antes de aplicar la 372', n;
  end if;

  select count(*) into n
  from (
    select 1
    from ci_facturas_canal_pendientes
    where coalesce(estado, '') <> 'error'
      and coalesce(extracted->>'supplier_rif', '') <> ''
      and coalesce(extracted->>'invoice_number', '') <> ''
    group by
      upper(regexp_replace(extracted->>'supplier_rif', '[^A-Za-z0-9]', '', 'g')),
      upper(regexp_replace(extracted->>'invoice_number', '[^A-Za-z0-9]', '', 'g'))
    having count(*) > 1
  ) d;
  if n > 0 then
    raise exception 'Hay % grupo(s) de facturas duplicadas en ci_facturas_canal_pendientes; resolver antes de aplicar la 372', n;
  end if;
end $$;

create unique index if not exists uq_purchase_invoices_rif_numero
  on purchase_invoices (
    upper(regexp_replace(supplier_rif, '[^A-Za-z0-9]', '', 'g')),
    upper(regexp_replace(invoice_number, '[^A-Za-z0-9]', '', 'g'))
  )
  where coalesce(supplier_rif, '') <> '' and coalesce(invoice_number, '') <> '';

create unique index if not exists uq_facturas_canal_rif_numero
  on ci_facturas_canal_pendientes (
    upper(regexp_replace(extracted->>'supplier_rif', '[^A-Za-z0-9]', '', 'g')),
    upper(regexp_replace(extracted->>'invoice_number', '[^A-Za-z0-9]', '', 'g'))
  )
  where coalesce(estado, '') <> 'error'
    and coalesce(extracted->>'supplier_rif', '') <> ''
    and coalesce(extracted->>'invoice_number', '') <> '';

create table if not exists ci_facturas_historial_cambios (
  id uuid primary key default gen_random_uuid(),
  tabla text not null check (tabla in ('ci_facturas_canal_pendientes', 'purchase_invoices')),
  registro_id uuid not null,
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  origen text not null check (origen in ('telegram', 'web')),
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists ci_facturas_historial_registro_idx
  on ci_facturas_historial_cambios (tabla, registro_id, created_at desc);

alter table ci_facturas_historial_cambios enable row level security;
