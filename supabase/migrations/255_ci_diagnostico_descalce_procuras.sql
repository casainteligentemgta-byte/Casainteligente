-- Auditoría cambiaria: procuras con posible descalce (coalesce Bs→USD en 236, tasa incoherente).

create or replace function public.ci_diagnostico_descalce_procuras()
returns table (
  procura_id uuid,
  ticket text,
  monto_estimado_usd numeric,
  real_ves numeric,
  real_usd numeric,
  tasa_bcv numeric,
  desviacion_usd numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with vinculadas as (
    select
      p.id as procura_id,
      p.ticket,
      p.monto_estimado_usd,
      p.desviacion_usd as desviacion_guardada,
      cc.monto_ves,
      cc.monto_usd,
      cc.total_amount,
      cc.total_amount_usd,
      cc.tasa_bcv_ves_por_usd,
      coalesce(cc.total_amount_usd, cc.total_amount, 0) as real_usd_coalesce,
      coalesce(cc.monto_usd, cc.total_amount_usd) as real_usd_correcto
    from public.ci_procuras p
    inner join public.contabilidad_compras cc
      on cc.purchase_invoice_id = p.purchase_invoice_id
    where p.purchase_invoice_id is not null
  ),
  flagged as (
    select
      v.*,
      coalesce(
        v.desviacion_guardada,
        v.real_usd_coalesce - coalesce(v.monto_estimado_usd, 0)
      ) as desv_calc
    from vinculadas v
    where
      -- coalesce(total_amount_usd, total_amount) usa Bs como USD (236)
      (
        v.total_amount_usd is null
        and v.monto_ves is not null
        and v.monto_usd is not null
        and abs(v.real_usd_coalesce - v.monto_ves) < 0.02
        and abs(v.real_usd_coalesce - v.monto_usd) > greatest(v.monto_usd * 0.05, 1)
      )
      or (
        v.total_amount_usd is null
        and v.monto_usd is null
        and v.monto_ves is not null
        and v.monto_ves > 50
        and abs(v.real_usd_coalesce - v.monto_ves) < 0.02
      )
      -- monto_ves / tasa no cuadra con monto_usd
      or (
        v.tasa_bcv_ves_por_usd > 0
        and v.monto_usd > 0
        and v.monto_ves > 0
        and abs((v.monto_ves / v.tasa_bcv_ves_por_usd) - v.monto_usd)
          > greatest(v.monto_usd * 0.03, 0.5)
      )
      -- desviación inflada por bug de coalesce, coherente con monto_usd real
      or (
        v.monto_estimado_usd is not null
        and v.monto_estimado_usd > 0
        and v.real_usd_correcto is not null
        and abs(v.real_usd_coalesce - v.monto_estimado_usd) > v.monto_estimado_usd * 0.25
        and abs(v.real_usd_correcto - v.monto_estimado_usd) <= v.monto_estimado_usd * 0.25
        and abs(v.real_usd_coalesce - v.real_usd_correcto) > greatest(v.real_usd_correcto * 0.1, 1)
      )
  )
  select
    f.procura_id,
    f.ticket,
    round(f.monto_estimado_usd, 2),
    round(coalesce(f.monto_ves, 0), 2),
    round(coalesce(f.real_usd_correcto, f.real_usd_coalesce, 0), 2),
    round(coalesce(f.tasa_bcv_ves_por_usd, 0), 4),
    round(coalesce(f.desv_calc, 0), 2)
  from flagged f
  order by abs(coalesce(f.desv_calc, 0)) desc;
$$;

comment on function public.ci_diagnostico_descalce_procuras() is
  'Auditoría: procuras vinculadas con posible descalce cambiario o error bimonetario.';

revoke all on function public.ci_diagnostico_descalce_procuras() from public;
grant execute on function public.ci_diagnostico_descalce_procuras() to service_role;

notify pgrst, 'reload schema';
