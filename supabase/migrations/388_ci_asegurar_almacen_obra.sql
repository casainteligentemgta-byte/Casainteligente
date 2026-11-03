-- Almacén central de obra: cada ci_proyectos nuevo también recibe un
-- inv_ubicaciones tipo almacen_central (hijo de la ubicación obra).
-- Extiende el trigger de 253 (tr_inv_ci_proyecto_ubicacion_obra).
-- Idempotente: no duplica si ya hay almacén con ese ci_proyecto_id;
-- si el código DEP-xxxxxxxxxxxx choca, prueba sufijos.

-- ── RPC: crea o devuelve el almacén de la obra ──────────────────────────────
create or replace function public.ci_asegurar_almacen_obra(
  p_proyecto_id uuid,
  p_nombre text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_activo boolean;
  v_padre_id uuid;
  v_nombre_obra text;
  v_nombre text;
  v_codigo text;
  v_codigo_base text;
  v_entidad_id uuid;
  v_n integer := 0;
  v_tiene_entidad boolean;
begin
  if p_proyecto_id is null then
    raise exception 'Proyecto requerido para almacén de obra';
  end if;

  select u.id, u.activo
    into v_id, v_activo
    from public.inv_ubicaciones u
   where u.ci_proyecto_id = p_proyecto_id
     and u.tipo in ('almacen_central', 'almacen_movil')
   order by u.activo desc, u.created_at
   limit 1;

  if v_id is not null then
    if v_activo is not true then
      update public.inv_ubicaciones
         set activo = true,
             updated_at = now()
       where id = v_id;
    end if;
    return v_id;
  end if;

  select p.nombre, p.entidad_id
    into v_nombre_obra, v_entidad_id
    from public.ci_proyectos p
   where p.id = p_proyecto_id;

  v_nombre_obra := coalesce(nullif(trim(p_nombre), ''), nullif(trim(v_nombre_obra), ''), 'Obra');
  v_nombre := 'ALMACÉN – ' || v_nombre_obra;

  v_padre_id := public.ci_asegurar_ubicacion_obra(p_proyecto_id, v_nombre_obra);

  v_codigo_base := 'DEP-' || upper(left(replace(p_proyecto_id::text, '-', ''), 12));
  v_codigo := v_codigo_base;

  v_tiene_entidad := exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'inv_ubicaciones'
       and column_name = 'entidad_id'
  );

  loop
    begin
      if v_tiene_entidad then
        insert into public.inv_ubicaciones (
          codigo, nombre, tipo, ci_proyecto_id, ubicacion_padre_id, entidad_id, descripcion, activo
        ) values (
          v_codigo, v_nombre, 'almacen_central', p_proyecto_id, v_padre_id, v_entidad_id,
          'Almacén de obra (auto)', true
        )
        returning id into v_id;
      else
        insert into public.inv_ubicaciones (
          codigo, nombre, tipo, ci_proyecto_id, ubicacion_padre_id, descripcion, activo
        ) values (
          v_codigo, v_nombre, 'almacen_central', p_proyecto_id, v_padre_id,
          'Almacén de obra (auto)', true
        )
        returning id into v_id;
      end if;
      return v_id;
    exception
      when unique_violation then
        select u.id
          into v_id
          from public.inv_ubicaciones u
         where u.ci_proyecto_id = p_proyecto_id
           and u.tipo in ('almacen_central', 'almacen_movil')
         order by u.activo desc, u.created_at
         limit 1;
        if v_id is not null then
          return v_id;
        end if;

        v_n := v_n + 1;
        if v_n > 20 then
          raise exception
            'No se pudo crear almacén de obra para proyecto % (código ocupado)',
            p_proyecto_id;
        end if;
        v_codigo := v_codigo_base || '-' || v_n::text;
    end;
  end loop;

  raise exception 'No se pudo crear almacén de obra para proyecto %', p_proyecto_id;
end;
$$;

comment on function public.ci_asegurar_almacen_obra(uuid, text) is
  'Crea o devuelve inv_ubicaciones tipo almacen_central de la obra (Telegram, ingresos). Idempotente.';

revoke execute on function public.ci_asegurar_almacen_obra(uuid, text) from public, anon;
grant execute on function public.ci_asegurar_almacen_obra(uuid, text) to authenticated, service_role;

-- ── Trigger: tras la ubicación obra, el almacén hijo ────────────────────────
create or replace function public.inv_trg_ci_proyecto_ubicacion_obra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.ci_asegurar_ubicacion_obra(NEW.id, NEW.nombre);
  exception
    when others then
      raise warning 'inv_trg_ci_proyecto_ubicacion_obra proyecto %: %', NEW.id, sqlerrm;
  end;
  begin
    perform public.ci_asegurar_almacen_obra(NEW.id, NEW.nombre);
  exception
    when others then
      raise warning 'inv_trg_ci_proyecto_almacen_obra proyecto %: %', NEW.id, sqlerrm;
  end;
  return NEW;
end;
$$;

comment on function public.inv_trg_ci_proyecto_ubicacion_obra() is
  'AFTER INSERT ci_proyectos: ubicación obra raíz + almacén central hijo (253 + 388).';

drop trigger if exists tr_inv_ci_proyecto_ubicacion_obra on public.ci_proyectos;
create trigger tr_inv_ci_proyecto_ubicacion_obra
  after insert on public.ci_proyectos
  for each row
  execute function public.inv_trg_ci_proyecto_ubicacion_obra();

-- ── Backfill: obras no DEMO sin almacén ─────────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select p.id, p.nombre
      from public.ci_proyectos p
     where coalesce(p.nombre, '') not ilike '%[DEMO]%'
       and coalesce(p.nombre, '') not ilike 'DEMO-%'
       and not exists (
         select 1
           from public.inv_ubicaciones u
          where u.ci_proyecto_id = p.id
            and u.tipo in ('almacen_central', 'almacen_movil')
       )
  loop
    begin
      perform public.ci_asegurar_almacen_obra(r.id, r.nombre);
    exception
      when others then
        raise warning 'ci_asegurar_almacen_obra backfill proyecto %: %', r.id, sqlerrm;
    end;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
