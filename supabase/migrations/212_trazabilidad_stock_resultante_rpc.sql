-- RPC auxiliar: stock acumulado por material+ubicación en el instante de cada movimiento.

create or replace function public.ci_stock_resultante_por_movimientos(p_movimiento_ids uuid[])
returns table (
  movimiento_id uuid,
  stock_resultante numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as movimiento_id,
    coalesce(
      (
        select sum(
          coalesce(
            nullif(m2.delta_disponible, 0),
            nullif(m2.delta_reservada, 0),
            m2.delta_transito_entrante,
            0
          )
        )
        from public.inv_movimientos m2
        where m2.material_id = m.material_id
          and m2.ubicacion_id = m.ubicacion_id
          and (
            m2.created_at < m.created_at
            or (m2.created_at = m.created_at and m2.id <= m.id)
          )
      ),
      0
    )::numeric as stock_resultante
  from public.inv_movimientos m
  where m.id = any(p_movimiento_ids);
$$;

comment on function public.ci_stock_resultante_por_movimientos(uuid[]) is
  'Stock disponible acumulado (ledger inv_movimientos) en el instante de cada movimiento.';

grant execute on function public.ci_stock_resultante_por_movimientos(uuid[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
