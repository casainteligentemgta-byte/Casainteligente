-- Reclutamiento y RRHH: solo con sesión, o con el enlace personal del candidato.
-- Tercera parte del cierre (342 inventario y compras, 345 contabilidad y presupuestos).
--
-- Antes, con la llave pública del sitio (la que viaja en el navegador) cualquiera podía,
-- sin iniciar sesión:
--   · leer la lista de obras y las vacantes;
--   · leer, cambiar y borrar contratos de trabajo, la configuración de nómina (salarios,
--     bonos, tasa), exámenes y sus preguntas, asignaciones de personal y solicitudes;
--   · crear expedientes de trabajadores con cualquier dato, incluidos los que dan permisos
--     en el bot de Telegram;
--   · llamar la función que firma un contrato y asigna al trabajador a una obra.
--
-- Qué queda después:
--   · Personal con sesión y servidor (rutas API, bot): igual que antes.
--   · Candidato sin sesión, con su enlace (token de invitación en la cabecera
--     x-invite-token): ve y completa SOLO su propio expediente, y no puede tocar los
--     campos que decide la empresa (evaluación, cargo, obra, firma, permisos del bot).
--   · Cualquier otra persona sin sesión: nada.
--
-- Los formularios públicos ya no leen vacantes, obras ni contratos desde el navegador:
-- se los entrega el servidor (app/api/reclutamiento/vacante, firma-resumen y patrono).
-- Esa versión del sitio debe estar publicada ANTES de ejecutar esta migración.
--
-- Idempotente: una segunda ejecución no encuentra nada que cambiar.

-- 1) Campos del expediente que el candidato no decide ---------------------------------

create or replace function public.ci_empleados_campos_reservados()
returns trigger
language plpgsql
as $$
begin
  -- Solo aplica a quien escribe sin sesión (formulario público). El personal con sesión
  -- y el servidor no pasan por aquí.
  if current_user <> 'anon' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Un expediente nuevo nace sin permisos del bot, sin empresa asignada y sin firma.
    new.telegram_chat_id := null;
    new.telegram_username := null;
    new.alertas_almacen_global := false;
    new.entidad_id := null;
    new.firma_electronica_url := null;
    new.firma_electronica_id := null;
    new.firma_electronica_at := null;
    return new;
  end if;

  -- Al completar su expediente, el candidato no cambia lo que decide la empresa.
  new.id := old.id;
  new.token := old.token;
  new.token_registro := old.token_registro;
  new.telegram_chat_id := old.telegram_chat_id;
  new.telegram_username := old.telegram_username;
  new.alertas_almacen_global := old.alertas_almacen_global;
  new.entidad_id := old.entidad_id;
  new.proyecto_id := old.proyecto_id;
  new.proyecto_modulo_id := old.proyecto_modulo_id;
  new.recruitment_need_id := old.recruitment_need_id;
  new.cargo_codigo := old.cargo_codigo;
  new.cargo_nombre := old.cargo_nombre;
  new.cargo_nivel := old.cargo_nivel;
  new.tipo_vacante := old.tipo_vacante;
  new.rol_examen := old.rol_examen;
  new.semaforo := old.semaforo;
  new.semaforo_riesgo := old.semaforo_riesgo;
  new.estado := old.estado;
  new.estatus := old.estatus;
  new.status_evaluacion := old.status_evaluacion;
  new.estatus_evaluacion := old.estatus_evaluacion;
  new.puntaje_personalidad := old.puntaje_personalidad;
  new.puntaje_logica := old.puntaje_logica;
  new.puntaje_total := old.puntaje_total;
  new.observaciones_rrhh := old.observaciones_rrhh;
  new.firma_electronica_url := old.firma_electronica_url;
  new.firma_electronica_id := old.firma_electronica_id;
  new.firma_electronica_at := old.firma_electronica_at;
  return new;
end
$$;

comment on function public.ci_empleados_campos_reservados() is
  'Sin sesión (formulario público) no se pueden fijar ni cambiar los campos del expediente que decide la empresa.';

-- El nombre empieza por «a_» para que se ejecute antes que los demás disparadores.
drop trigger if exists a_ci_empleados_campos_reservados on public.ci_empleados;
create trigger a_ci_empleados_campos_reservados
  before insert or update on public.ci_empleados
  for each row execute function public.ci_empleados_campos_reservados();

-- 2) Expediente del candidato: solo con su enlace ---------------------------------------

-- Crear el expediente exige enviar el mismo token con que se guarda (es lo que hace el
-- formulario de postulación). Antes bastaba con la llave pública.
drop policy if exists ci_empleados_anon_insert on public.ci_empleados;
drop policy if exists ci_empleados_insert_anon on public.ci_empleados;
drop policy if exists ci_empleados_insert_con_enlace on public.ci_empleados;
create policy ci_empleados_insert_con_enlace on public.ci_empleados
  for insert to anon
  with check (
    public.ci_invite_token_header() is not null
    and length(public.ci_invite_token_header()) >= 32
    and token_registro = public.ci_invite_token_header()
  );

-- Leer y completar el propio expediente (políticas ci_empleados_public_read_by_token y
-- ci_empleados_public_update_by_token) se conserva. Se retira lo que no se usa:
-- borrar, vaciar la tabla, etc.
revoke all on public.ci_empleados from anon;
grant select, insert, update on public.ci_empleados to anon;

-- Hoja de vida: solo para el expediente dueño del enlace (antes, para cualquiera).
drop policy if exists ci_hojas_vida_public_insert on public.ci_hojas_vida;
drop policy if exists ci_hojas_vida_insert_con_enlace on public.ci_hojas_vida;
create policy ci_hojas_vida_insert_con_enlace on public.ci_hojas_vida
  for insert to anon
  with check (
    public.ci_invite_token_header() is not null
    and exists (
      select 1
      from public.ci_empleados e
      where e.id = ci_hojas_vida.empleado_id
        and (
          e.token_registro = public.ci_invite_token_header()
          or e.token = public.ci_invite_token_header()
        )
    )
  );

revoke all on public.ci_hojas_vida from anon;
grant insert on public.ci_hojas_vida to anon;

-- 3) Resto de las tablas de RRHH y obras: solo con sesión -------------------------------

do $$
declare
  t text;
  p record;
  f record;
  ya_cubierta boolean;
  nuevo_nombre text;
  tablas text[] := array[
    -- obras y vacantes (los formularios las reciben del servidor)
    'ci_proyectos', 'recruitment_needs',
    -- contratos, nómina y asignaciones
    'ci_contratos_empleado_obra', 'ci_config_nomina', 'ci_obra_empleados',
    'ci_materiales_obra', 'labor_requests', 'project_assignments',
    'obreros_expediente_tarea',
    -- exámenes y evaluación
    'ci_examenes', 'ci_preguntas', 'ci_psique_categorias', 'ci_psique_pruebas',
    'ci_psique_triggers'
  ];
begin
  foreach t in array tablas loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    for p in
      select policyname, cmd, roles
      from pg_policies
      where schemaname = 'public'
        and tablename = t
        and roles && array['anon', 'public']::name[]
    loop
      -- ¿Otra política ya da lo mismo, sin condiciones, a quien tiene sesión?
      select exists (
        select 1
        from pg_policies o
        where o.schemaname = 'public'
          and o.tablename = t
          and o.policyname <> p.policyname
          and 'authenticated' = any (o.roles)
          and not (o.roles && array['anon', 'public']::name[])
          and (o.cmd = p.cmd or o.cmd = 'ALL')
          and coalesce(o.qual, 'true') = 'true'
          and coalesce(o.with_check, 'true') = 'true'
      ) into ya_cubierta;

      if ya_cubierta and p.roles = array['anon']::name[] then
        execute format('drop policy %I on public.%I', p.policyname, t);
      else
        execute format('alter policy %I on public.%I to authenticated', p.policyname, t);
        if p.policyname ~ '_anon$' then
          nuevo_nombre := regexp_replace(p.policyname, '_anon$', '_sesion');
          if not exists (
            select 1 from pg_policies
            where schemaname = 'public' and tablename = t and policyname = nuevo_nombre
          ) then
            execute format('alter policy %I on public.%I rename to %I', p.policyname, t, nuevo_nombre);
          end if;
        end if;
      end if;
    end loop;

    execute format('revoke all on public.%I from anon', t);
  end loop;

  -- 4) Firmar contrato y asignar a obra: solo el servidor ------------------------------
  -- La llama la ruta /api/talento/contratos/firmar después de validar el token del
  -- trabajador. Antes cualquiera podía llamarla directamente con la llave pública.
  for f in
    select pr.oid::regprocedure as firma
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
    where n.nspname = 'public'
      and pr.proname = 'firmar_contrato_y_asignar'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
    execute format('grant execute on function %s to service_role', f.firma);
  end loop;
end
$$;

notify pgrst, 'reload schema';
