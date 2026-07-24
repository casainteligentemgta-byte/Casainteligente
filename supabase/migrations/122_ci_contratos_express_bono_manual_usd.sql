-- Bono express acordado en USD; en bolívares se liquida en cada pago (p. ej. viernes) con la tasa oficial del BCV vigente ese día.

do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'ci_contratos_express'
      and c.column_name = 'bono_manual_ves'
  ) then
    alter table public.ci_contratos_express rename column bono_manual_ves to bono_manual_usd;
  end if;
end $$;

comment on column public.ci_contratos_express.bono_manual_usd is
  'Bono variable acordado en USD (p. ej. semanal). El monto en bolívares se calcula al pagar multiplicando por la tasa oficial del BCV del día de pago.';

notify pgrst, 'reload schema';
