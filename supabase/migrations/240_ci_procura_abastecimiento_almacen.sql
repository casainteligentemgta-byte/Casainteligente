-- Abastecimiento post-aprobación: split despacho / compra y verificación depositario.

alter table public.ci_procuras
  add column if not exists cantidad_despacho numeric,
  add column if not exists cantidad_compra numeric,
  add column if not exists stock_almacen_detectado numeric,
  add column if not exists verificacion_almacen_at timestamptz,
  add column if not exists abastecimiento_codigo_despacho text;

comment on column public.ci_procuras.cantidad_despacho is
  'Cantidad a despachar desde almacén tras verificación depositario.';
comment on column public.ci_procuras.cantidad_compra is
  'Saldo pendiente de orden de compra tras despacho parcial o sin stock.';
comment on column public.ci_procuras.stock_almacen_detectado is
  'Stock en almacén físico detectado al aprobar la procura.';
comment on column public.ci_procuras.verificacion_almacen_at is
  'Marca de envío de orden de verificación al depositario.';
comment on column public.ci_procuras.abastecimiento_codigo_despacho is
  'Código de transferencia SAL-* generada al despachar desde almacén.';

create or replace function public.ci_procura_transicion_estado_valida(
  p_estado_anterior text,
  p_estado_nuevo text
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_ant text := lower(btrim(coalesce(p_estado_anterior, '')));
  v_nue text := lower(btrim(coalesce(p_estado_nuevo, '')));
begin
  if v_ant = v_nue then
    return true;
  end if;

  case v_ant
    when 'borrador' then
      return v_nue in ('solicitada', 'cancelada');
    when 'solicitada' then
      return v_nue in (
        'aprobada',
        'aprobada_directa',
        'en_compra',
        'rechazada',
        'cancelada'
      );
    when 'aprobada' then
      return v_nue in (
        'en_compra',
        'recibida',
        'recibida_parcial',
        'rechazada',
        'cancelada'
      );
    when 'aprobada_directa' then
      return v_nue in ('en_compra', 'cancelada');
    when 'en_compra' then
      return v_nue in ('recibida_parcial', 'recibida', 'cancelada');
    when 'recibida_parcial' then
      return v_nue in ('recibida', 'en_compra', 'cancelada');
    when 'recibida' then
      return v_nue in ('cancelada');
    when 'rechazada', 'cancelada' then
      return false;
    else
      return false;
  end case;
end;
$$;
