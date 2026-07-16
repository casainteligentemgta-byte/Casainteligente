-- Capítulo presupuestario en egresos Telegram (depositario) + trazabilidad.

alter table public.ci_obra_movimientos_material
  add column if not exists capitulo_id uuid references public.capitulos (id) on delete set null;

alter table public.ci_obra_movimientos_material
  add column if not exists capitulo_nombre text;

create index if not exists idx_ci_obra_movimientos_capitulo
  on public.ci_obra_movimientos_material (capitulo_id)
  where capitulo_id is not null;

comment on column public.ci_obra_movimientos_material.capitulo_id is
  'Capítulo de presupuesto al que se imputa el egreso registrado por Telegram.';
comment on column public.ci_obra_movimientos_material.capitulo_nombre is
  'Denormalizado para listados cuando el capítulo se crea o renombra desde Telegram.';

notify pgrst, 'reload schema';
