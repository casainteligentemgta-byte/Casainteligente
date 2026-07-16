-- Repara inv_ubicaciones tipo obra sin proyecto y centraliza el alta en RPC.
-- Error típico: inv_ubicaciones_tipo_obra (tipo=obra sin ci_proyecto_id ni ubicacion_padre_id).

-- 1) Vincular obras huérfanas por nombre de proyecto
update public.inv_ubicaciones u
   set ci_proyecto_id = p.id,
       updated_at = now()
  from public.ci_proyectos p
 where u.tipo = 'obra'
   and u.ci_proyecto_id is null
   and u.ubicacion_padre_id is null
   and lower(trim(u.nombre)) = lower(trim(p.nombre));

-- 2) RPC idempotente: ubicación raíz tipo obra para un proyecto
create or replace function public.ci_asegurar_ubicacion_obra(
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
  v_nombre text := coalesce(nullif(trim(p_nombre), ''), 'Obra');
  v_codigo text;
begin
  if p_proyecto_id is null then
    raise exception 'Proyecto requerido para ubicación de obra';
  end if;

  select u.id
    into v_id
    from public.inv_ubicaciones u
   where u.tipo = 'obra'
     and u.ubicacion_padre_id is null
     and u.ci_proyecto_id = p_proyecto_id
   order by u.activo desc, u.created_at
   limit 1;

  if v_id is not null then
    return v_id;
  end if;

  update public.inv_ubicaciones u
     set ci_proyecto_id = p_proyecto_id,
         updated_at = now()
   where u.tipo = 'obra'
     and u.ci_proyecto_id is null
     and u.ubicacion_padre_id is null
     and lower(trim(u.nombre)) = lower(trim(v_nombre))
  returning u.id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  v_codigo := 'OBRA-' || replace(p_proyecto_id::text, '-', '');

  insert into public.inv_ubicaciones (codigo, nombre, tipo, ci_proyecto_id, descripcion, activo)
  values (v_codigo, v_nombre, 'obra', p_proyecto_id, 'Ubicación de obra (auto)', true)
  on conflict (codigo) do update
    set nombre = excluded.nombre,
        ci_proyecto_id = coalesce(public.inv_ubicaciones.ci_proyecto_id, excluded.ci_proyecto_id),
        tipo = case
          when public.inv_ubicaciones.deposit_id is null then 'obra'
          else public.inv_ubicaciones.tipo
        end,
        updated_at = now()
  returning id into v_id;

  if v_id is null then
    select u.id
      into v_id
      from public.inv_ubicaciones u
     where u.codigo = v_codigo
     limit 1;
  end if;

  if v_id is null then
    select u.id
      into v_id
      from public.inv_ubicaciones u
     where u.tipo = 'obra'
       and u.ubicacion_padre_id is null
       and u.ci_proyecto_id = p_proyecto_id
     limit 1;
  end if;

  if v_id is null then
    raise exception 'No se pudo crear ubicación de obra para proyecto %', p_proyecto_id;
  end if;

  return v_id;
end;
$$;

comment on function public.ci_asegurar_ubicacion_obra(uuid, text) is
  'Crea o devuelve inv_ubicaciones raíz tipo obra vinculada a ci_proyectos (Telegram, ingresos, despachos).';

grant execute on function public.ci_asegurar_ubicacion_obra(uuid, text) to anon, authenticated, service_role;

-- 3) Backfill: todo proyecto sin ubicación obra raíz
do $$
declare
  r record;
begin
  for r in
    select p.id, p.nombre
      from public.ci_proyectos p
     where not exists (
       select 1
         from public.inv_ubicaciones u
        where u.ci_proyecto_id = p.id
          and u.tipo = 'obra'
          and u.ubicacion_padre_id is null
     )
  loop
    perform public.ci_asegurar_ubicacion_obra(r.id, r.nombre);
  end loop;
end;
$$;

-- 4) Nuevos proyectos → ubicación obra automática
create or replace function public.inv_trg_ci_proyecto_ubicacion_obra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ci_asegurar_ubicacion_obra(NEW.id, NEW.nombre);
  return NEW;
exception
  when others then
    raise warning 'inv_trg_ci_proyecto_ubicacion_obra proyecto %: %', NEW.id, sqlerrm;
    return NEW;
end;
$$;

drop trigger if exists tr_inv_ci_proyecto_ubicacion_obra on public.ci_proyectos;
create trigger tr_inv_ci_proyecto_ubicacion_obra
  after insert on public.ci_proyectos
  for each row
  execute function public.inv_trg_ci_proyecto_ubicacion_obra();

notify pgrst, 'reload schema';
