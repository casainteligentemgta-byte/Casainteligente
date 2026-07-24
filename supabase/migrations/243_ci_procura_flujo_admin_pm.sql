-- Flujo vía larga: Administrador informa viabilidad → PM aprueba/rechaza.

alter table public.ci_procuras
  add column if not exists viabilidad_presupuestaria text,
  add column if not exists viabilidad_informada_por text,
  add column if not exists viabilidad_informada_telegram_id bigint,
  add column if not exists viabilidad_informada_at timestamptz;

comment on column public.ci_procuras.viabilidad_presupuestaria is
  'Manual: si | no — informado por Administrador antes de revisión PM.';
comment on column public.ci_procuras.viabilidad_informada_por is
  'Nombre del Administrador que informó viabilidad presupuestaria.';
comment on column public.ci_procuras.viabilidad_informada_telegram_id is
  'Telegram chat id del Administrador que informó viabilidad.';

alter table public.ci_procuras
  drop constraint if exists ci_procuras_estado_check;

alter table public.ci_procuras
  add constraint ci_procuras_estado_check
  check (
    estado in (
      'borrador',
      'solicitada',
      'pendiente_pm',
      'aprobada',
      'aprobada_directa',
      'en_compra',
      'recibida_parcial',
      'recibida',
      'cancelada',
      'rechazada'
    )
  );

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
        'pendiente_pm',
        'aprobada',
        'aprobada_directa',
        'en_compra',
        'rechazada',
        'cancelada'
      );
    when 'pendiente_pm' then
      return v_nue in ('aprobada', 'rechazada', 'cancelada');
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

notify pgrst, 'reload schema';
