-- Obra por defecto para compras del propietario (regla de destino de facturas).
alter table public.ci_proyectos
  add column if not exists compra_default boolean not null default false;

-- Procodima, C.A. → Obra Gaspar Marcano – Etapa 2
-- Inversiones Neroca 78 Mil, C.A. → Villa Zoita 2026 – Etapa 2
update public.ci_proyectos
set compra_default = true
where id in (
  'af7128c8-fc25-4590-96e8-c56b19214e68',
  '2a9c5dc4-6e0a-4264-a3d2-81438a2163c3'
);
