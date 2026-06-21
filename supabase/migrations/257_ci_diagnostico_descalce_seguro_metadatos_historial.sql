-- Endurecer RPC de auditoría cambiaria (filtro auth.uid + nómina/entidad).
-- Columna metadatos en historial de procuras (viabilidad admin).

alter table public.ci_procura_estados_historial
  add column if not exists metadatos jsonb not null default '{}'::jsonb;

comment on column public.ci_procura_estados_historial.metadatos is
  'Payload estructurado (viabilidad, origen, admin_usuario_id, etc.).';

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
  with acceso as (
    select
      auth.uid() as uid,
      coalesce(auth.role(), '') as jwt_role,
      lower(trim(coalesce(auth.jwt() ->> 'email', ''))) as jwt_email
  ),
  proyectos_permitidos as (
    select distinct pn.proyecto_id
    from public.ci_proyecto_nomina pn
    cross join acceso a
    where
      a.uid is not null
      and pn.activo = true
      and pn.proyecto_id is not null
      and pn.email is not null
      and lower(trim(pn.email)) = a.jwt_email
      and a.jwt_email <> ''

    union

    select distinct p.id as proyecto_id
    from public.ci_proyectos p
    inner join public.ci_usuarios_roles ur on ur.entidad_id = p.entidad_id
    cross join acceso a
    where a.uid is not null and ur.usuario_id = a.uid
  ),
  vinculadas as (
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
    cross join acceso a
    where
      p.purchase_invoice_id is not null
      and (
        a.jwt_role = 'service_role'
        or p.proyecto_id in (select pp.proyecto_id from proyectos_permitidos pp)
      )
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
      or (
        v.tasa_bcv_ves_por_usd > 0
        and v.monto_usd > 0
        and v.monto_ves > 0
        and abs((v.monto_ves / v.tasa_bcv_ves_por_usd) - v.monto_usd)
          > greatest(v.monto_usd * 0.03, 0.5)
      )
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
  'Auditoría: procuras vinculadas con posible descalce cambiario. Filtra por auth.uid() vía nómina/entidad; service_role ve todo.';

revoke all on function public.ci_diagnostico_descalce_procuras() from public;
grant execute on function public.ci_diagnostico_descalce_procuras() to service_role;
grant execute on function public.ci_diagnostico_descalce_procuras() to authenticated;

notify pgrst, 'reload schema';
