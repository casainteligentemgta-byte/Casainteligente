-- RPC: firma digital móvil (onboarding) + asignación a obra/proyecto y costo hora en cuadrilla.

alter table public.ci_obra_empleados
  add column if not exists costo_hora_acordado numeric(14, 4);

comment on column public.ci_obra_empleados.costo_hora_acordado is
  'Costo/hora acordado al firmar contrato (reclutamiento / LOPCYMAT).';

create or replace function public.firmar_contrato_y_asignar(
  p_empleado_id uuid,
  p_proyecto_id uuid,
  p_requisicion_id uuid,
  p_costo_hora_acordado numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctr uuid;
begin
  if p_empleado_id is null or p_proyecto_id is null then
    return jsonb_build_object('ok', false, 'error', 'parametros_invalidos');
  end if;

  select c.id
  into v_ctr
  from public.ci_contratos_empleado_obra c
  where c.empleado_id = p_empleado_id
  order by c.created_at desc
  limit 1;

  if v_ctr is null then
    return jsonb_build_object('ok', false, 'error', 'sin_contrato');
  end if;

  update public.ci_contratos_empleado_obra c
  set
    obrero_aceptacion_contrato_at = coalesce(c.obrero_aceptacion_contrato_at, now()),
    estado_contrato = case
      when c.estado_contrato in ('generado', 'firmado_electronico') then 'firmado_electronico'
      else c.estado_contrato
    end
  where c.id = v_ctr;

  update public.ci_empleados e
  set
    proyecto_modulo_id = p_proyecto_id,
    recruitment_need_id = coalesce(p_requisicion_id, e.recruitment_need_id),
    estatus = 'asignado'
  where e.id = p_empleado_id;

  insert into public.ci_obra_empleados (obra_id, empleado_id, honorarios_acordados_usd, multas_acumuladas_usd, costo_hora_acordado)
  values (p_proyecto_id, p_empleado_id, 0, 0, p_costo_hora_acordado)
  on conflict (obra_id, empleado_id) do update
  set costo_hora_acordado = excluded.costo_hora_acordado;

  return jsonb_build_object('ok', true, 'contrato_id', v_ctr);
end;
$$;

comment on function public.firmar_contrato_y_asignar(uuid, uuid, uuid, numeric) is
  'Marca aceptación del contrato, asigna proyecto/cuadrilla y guarda costo hora (firma wizard móvil).';

revoke all on function public.firmar_contrato_y_asignar(uuid, uuid, uuid, numeric) from public;
grant execute on function public.firmar_contrato_y_asignar(uuid, uuid, uuid, numeric) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
