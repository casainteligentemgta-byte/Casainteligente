-- Vista ejecutiva: mano de obra por proyecto (solicitudes pending vs asignaciones).
-- Consumo: /admin/dashboard-operativo y reportes.

create or replace view public.global_labor_overview as
with pending_lr as (
  select lr.*
  from public.labor_requests lr
  where lr.status = 'pending'
),
ped as (
  select
    project_id,
    coalesce(sum(quantity_requested), 0)::int as plazas_pedidas,
    count(*)::int as solicitudes_pendientes
  from pending_lr
  group by project_id
),
asg_pending as (
  select
    pa.project_id,
    count(*)::int as plazas_asignadas
  from public.project_assignments pa
  inner join pending_lr lr on lr.id = pa.labor_request_id
  group by pa.project_id
),
trans as (
  select
    lr.project_id,
    count(*)::int as solicitudes_en_transito
  from pending_lr lr
  where (
    select count(*)::bigint
    from public.project_assignments pa
    where pa.labor_request_id = lr.id
  ) > 0
  and (
    select count(*)::bigint
    from public.project_assignments pa
    where pa.labor_request_id = lr.id
  ) < lr.quantity_requested::bigint
  group by lr.project_id
),
pool as (
  select count(*)::int as disponibilidad_pool
  from public.ci_empleados e
  where coalesce(trim(e.rol_examen::text), '') ilike 'obrero'
    and coalesce(trim(e.estado::text), '') ilike 'aprobado'
    and (e.estatus is null or trim(e.estatus::text) ilike 'disponible')
)
select
  p.id as project_id,
  coalesce(p.nombre, '') as project_name,
  coalesce(ped.plazas_pedidas, 0) as plazas_pedidas,
  coalesce(ap.plazas_asignadas, 0) as plazas_asignadas,
  greatest(0, coalesce(ped.plazas_pedidas, 0) - coalesce(ap.plazas_asignadas, 0))::int as plazas_pendiente_funnel,
  case
    when coalesce(ped.plazas_pedidas, 0) > 0 then
      round((100.0 * coalesce(ap.plazas_asignadas, 0)::numeric / ped.plazas_pedidas::numeric), 1)
    else 100.0
  end as cobertura_pct,
  coalesce(ped.solicitudes_pendientes, 0) as solicitudes_pendientes,
  coalesce(tr.solicitudes_en_transito, 0) as solicitudes_en_transito,
  (select disponibilidad_pool from pool) as disponibilidad_pool
from public.ci_proyectos p
left join ped on ped.project_id = p.id
left join asg_pending ap on ap.project_id = p.id
left join trans tr on tr.project_id = p.id;

comment on view public.global_labor_overview is
  'KPIs de mano de obra por proyecto: plazas pedidas (pending), asignadas, cobertura %, solicitudes en tránsito y pool global de obreros disponibles.';

grant select on public.global_labor_overview to anon, authenticated, service_role;

notify pgrst, 'reload schema';
