-- Vistas RRHH consolidadas + RPC conciliación compra vía Telegram (PR-XXXX).

-- Personal activo (obreros en nómina / asignados)
create or replace view public.ci_personal_activos as
select
  e.id,
  e.nombre_completo,
  coalesce(e.oficio, e.cargo, '') as oficio,
  coalesce(e.estatus, e.status, 'activo') as estatus,
  e.cedula,
  e.celular,
  e.created_at,
  e.proyecto_id
from public.ci_empleados e
where coalesce(e.estatus, e.status, '') not in ('rechazado', 'baja', 'inactivo')
  and coalesce(e.status, '') not in ('rechazado', 'baja', 'inactivo');

comment on view public.ci_personal_activos is
  'Vista consolidada de personal activo para hub RRHH.';

-- Postulantes en reclutamiento (exámenes / contratos express pendientes)
create or replace view public.ci_postulantes_reclutamiento as
select
  e.id,
  e.nombre_completo,
  coalesce(e.cedula, e.documento, '') as cedula,
  coalesce(e.oficio, '') as oficio,
  coalesce(e.status, e.estatus, 'pendiente') as estado,
  e.created_at,
  e.updated_at
from public.ci_empleados e
where coalesce(e.status, e.estatus, '') in (
  'pendiente',
  'evaluacion',
  'pendiente_regularizar',
  'examen_pendiente'
)
   or e.hoja_vida_obrero is not null
     and coalesce(e.status, '') not in ('activo', 'asignado', 'contratado');

comment on view public.ci_postulantes_reclutamiento is
  'Vista consolidada de postulantes en pipeline de reclutamiento.';

grant select on public.ci_personal_activos to anon, authenticated, service_role;
grant select on public.ci_postulantes_reclutamiento to anon, authenticated, service_role;

-- RPC: conciliar compra desde confirmación Telegram (ticket PR-XXXX)
create or replace function public.ci_procesar_conciliacion_compra(
  p_procura_id uuid,
  p_monto_usd numeric default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_procura record;
  v_items_count int;
begin
  select * into v_procura
    from public.ci_procuras
   where id = p_procura_id
   for update;

  if not found then
    raise exception 'Procura no encontrada: %', p_procura_id;
  end if;

  if v_procura.estado in ('rechazada', 'cancelada') then
    raise exception 'Procura % en estado terminal: %', v_procura.ticket, v_procura.estado;
  end if;

  v_items_count := coalesce(jsonb_array_length(p_items), 0);

  update public.ci_procuras
     set estado = case
           when estado in ('solicitada', 'pendiente_pm', 'borrador') then 'aprobada'
           when estado in ('aprobada', 'aprobada_directa') then 'en_compra'
           else estado
         end,
         monto_estimado_usd = coalesce(p_monto_usd, monto_estimado_usd),
         observaciones = coalesce(observaciones, '') ||
           case when v_items_count > 0
             then E'\n[Telegram conciliación] Ítems: ' || v_items_count::text
             else ''
           end,
         updated_at = now()
   where id = p_procura_id;

  return jsonb_build_object(
    'ok', true,
    'procura_id', p_procura_id,
    'ticket', v_procura.ticket,
    'items', v_items_count
  );
end;
$$;

grant execute on function public.ci_procesar_conciliacion_compra(uuid, numeric, jsonb) to service_role;

notify pgrst, 'reload schema';
