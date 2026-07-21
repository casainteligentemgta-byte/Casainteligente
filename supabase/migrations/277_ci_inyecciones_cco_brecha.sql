-- Campos CCO V4 en inyecciones: % brecha y tasa Binance (Control de Ingresos).

alter table public.ci_inyecciones_capital
  add column if not exists porcentaje_brecha_real numeric(10, 4);

alter table public.ci_inyecciones_capital
  add column if not exists tasa_binance numeric(18, 6);

comment on column public.ci_inyecciones_capital.porcentaje_brecha_real is
  'Brecha BCV/Binance del CSV maestro V4 (%), para Control de Ingresos.';

comment on column public.ci_inyecciones_capital.tasa_binance is
  'Tasa Binance opcional asociada al ingreso importado V4.';

notify pgrst, 'reload schema';
