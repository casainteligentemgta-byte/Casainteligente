-- Anti-duplicados CSV / libro: hash de llave natural (fecha+factura+proveedor+monto+obra).

alter table public.contabilidad_compras
  add column if not exists dedup_hash text;

comment on column public.contabilidad_compras.dedup_hash is
  'SHA-256 de llave natural: fecha|invoice|proveedor|monto|proyecto_id. Unique para evitar dobles cargas CSV.';

create unique index if not exists uq_contabilidad_compras_dedup_hash
  on public.contabilidad_compras (dedup_hash)
  where dedup_hash is not null;

notify pgrst, 'reload schema';
