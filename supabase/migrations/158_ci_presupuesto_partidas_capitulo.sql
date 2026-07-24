-- Capítulo Lulo por partida de presupuesto (orden y agrupación).

alter table public.ci_presupuesto_partidas
  add column if not exists capitulo_codigo text;

alter table public.ci_presupuesto_partidas
  add column if not exists capitulo_descripcion text;

alter table public.ci_presupuesto_partidas
  add column if not exists capitulo_orden integer not null default 0;

create index if not exists idx_ci_presupuesto_partidas_capitulo
  on public.ci_presupuesto_partidas (proyecto_id, capitulo_orden, capitulo_codigo);

comment on column public.ci_presupuesto_partidas.capitulo_codigo is 'Código capítulo Lulo (Cod_Cap) o inferido del código de partida.';
comment on column public.ci_presupuesto_partidas.capitulo_descripcion is 'Descripción del capítulo (tabla CAPITULOS o encabezado).';
comment on column public.ci_presupuesto_partidas.capitulo_orden is 'Orden de capítulo para listados (tabla CAPITULOS).';

notify pgrst, 'reload schema';
