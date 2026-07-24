-- Techo teórico de materiales por partida (APU × cantidad de obra) para control de compras.

alter table public.ci_presupuesto_partidas
  add column if not exists techo_teorico_material numeric(18, 2) not null default 0;

comment on column public.ci_presupuesto_partidas.techo_teorico_material is
  'Costo teórico de materiales: suma APU (tipo material) × cantidad_presupuestada de la partida.';

create index if not exists idx_ci_presupuesto_partidas_techo_material
  on public.ci_presupuesto_partidas (proyecto_id, techo_teorico_material)
  where techo_teorico_material > 0;
