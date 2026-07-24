-- Tasa BCV histórica en configuración global (fallback compras bimonetarias).

alter table public.ci_config_nomina
  add column if not exists tasa_bcv_ves_por_usd numeric(18, 6),
  add column if not exists tasa_bcv_vigencia_desde date;

comment on column public.ci_config_nomina.tasa_bcv_ves_por_usd is
  'Tasa oficial BCV (bolívares por 1 USD). Usada por fila GLOBAL y fallback de compras.';
comment on column public.ci_config_nomina.tasa_bcv_vigencia_desde is
  'Fecha desde la cual aplica la tasa BCV registrada en esta fila.';

insert into public.ci_config_nomina (
  cargo_nombre,
  cargo_codigo,
  salario_base_mensual,
  factor_prestacional,
  cestaticket_mensual,
  tasa_bcv_ves_por_usd,
  tasa_bcv_vigencia_desde
)
select
  'Configuración global',
  'GLOBAL',
  0,
  1,
  0,
  36.5,
  current_date
where not exists (
  select 1
  from public.ci_config_nomina c
  where upper(trim(c.cargo_codigo)) = 'GLOBAL'
);

notify pgrst, 'reload schema';
