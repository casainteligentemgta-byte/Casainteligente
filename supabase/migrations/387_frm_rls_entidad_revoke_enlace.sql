-- FRM / notas precargadas: RLS por entidad (ci_proyectos.entidad_id + ci_tiene_permiso_en_entidad).
-- Mismo patrón que migración 380 / 382. service_role (Telegram y APIs) no pasa por RLS.
-- Revoca EXECUTE authenticated de ci_enlazar_frm_con_compra_procura: solo el servidor
-- lo llama tras requireAlgunPermisoWeb.

create or replace function public.ci_frm_permiso_obra(p_proyecto_id uuid, p_permisos text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from unnest(p_permisos) as t(codigo)
     where public.ci_tiene_permiso_en_entidad(
       t.codigo,
       (select p.entidad_id from public.ci_proyectos p where p.id = p_proyecto_id)
     )
  );
$$;

revoke execute on function public.ci_frm_permiso_obra(uuid, text[]) from public, anon;
grant execute on function public.ci_frm_permiso_obra(uuid, text[]) to authenticated, service_role;

comment on function public.ci_frm_permiso_obra(uuid, text[]) is
  'SECURITY DEFINER: ¿el actor tiene alguno de los permisos en la entidad de la obra? Para RLS de FRM.';

-- ── ci_recepciones_campo ────────────────────────────────────────────────────
alter table public.ci_recepciones_campo enable row level security;

drop policy if exists "ci_recepciones_campo_select" on public.ci_recepciones_campo;
drop policy if exists "ci_recepciones_campo_insert" on public.ci_recepciones_campo;
drop policy if exists "ci_recepciones_campo_update" on public.ci_recepciones_campo;
drop policy if exists ci_recepciones_campo_select on public.ci_recepciones_campo;
drop policy if exists ci_recepciones_campo_insert on public.ci_recepciones_campo;
drop policy if exists ci_recepciones_campo_update on public.ci_recepciones_campo;
drop policy if exists ci_recepciones_campo_delete on public.ci_recepciones_campo;
drop policy if exists ci_recepciones_campo_select_sesion on public.ci_recepciones_campo;
drop policy if exists ci_recepciones_campo_insert_sesion on public.ci_recepciones_campo;
drop policy if exists ci_recepciones_campo_update_sesion on public.ci_recepciones_campo;

create policy ci_recepciones_campo_select on public.ci_recepciones_campo
  for select to authenticated
  using (
    public.ci_frm_permiso_obra(
      proyecto_id,
      array['almacen.ingreso', 'compra.registrar', 'almacen.despacho', 'almacen.cuarentena']
    )
  );

create policy ci_recepciones_campo_insert on public.ci_recepciones_campo
  for insert to authenticated
  with check (
    public.ci_frm_permiso_obra(proyecto_id, array['almacen.ingreso', 'compra.registrar'])
  );

create policy ci_recepciones_campo_update on public.ci_recepciones_campo
  for update to authenticated
  using (
    public.ci_frm_permiso_obra(proyecto_id, array['almacen.ingreso', 'compra.registrar'])
  )
  with check (
    public.ci_frm_permiso_obra(proyecto_id, array['almacen.ingreso', 'compra.registrar'])
  );

create policy ci_recepciones_campo_delete on public.ci_recepciones_campo
  for delete to authenticated
  using (
    public.ci_frm_permiso_obra(proyecto_id, array['almacen.ingreso', 'compra.registrar'])
  );

-- ── ci_recepciones_campo_lineas ─────────────────────────────────────────────
alter table public.ci_recepciones_campo_lineas enable row level security;

drop policy if exists "ci_recepciones_campo_lineas_select" on public.ci_recepciones_campo_lineas;
drop policy if exists "ci_recepciones_campo_lineas_insert" on public.ci_recepciones_campo_lineas;
drop policy if exists ci_recepciones_campo_lineas_select on public.ci_recepciones_campo_lineas;
drop policy if exists ci_recepciones_campo_lineas_insert on public.ci_recepciones_campo_lineas;
drop policy if exists ci_recepciones_campo_lineas_update on public.ci_recepciones_campo_lineas;
drop policy if exists ci_recepciones_campo_lineas_delete on public.ci_recepciones_campo_lineas;
drop policy if exists ci_recepciones_campo_lineas_select_sesion on public.ci_recepciones_campo_lineas;
drop policy if exists ci_recepciones_campo_lineas_insert_sesion on public.ci_recepciones_campo_lineas;

create policy ci_recepciones_campo_lineas_select on public.ci_recepciones_campo_lineas
  for select to authenticated
  using (
    exists (
      select 1
        from public.ci_recepciones_campo r
       where r.id = recepcion_id
         and public.ci_frm_permiso_obra(
           r.proyecto_id,
           array['almacen.ingreso', 'compra.registrar', 'almacen.despacho', 'almacen.cuarentena']
         )
    )
  );

create policy ci_recepciones_campo_lineas_insert on public.ci_recepciones_campo_lineas
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.ci_recepciones_campo r
       where r.id = recepcion_id
         and public.ci_frm_permiso_obra(r.proyecto_id, array['almacen.ingreso', 'compra.registrar'])
    )
  );

create policy ci_recepciones_campo_lineas_update on public.ci_recepciones_campo_lineas
  for update to authenticated
  using (
    exists (
      select 1
        from public.ci_recepciones_campo r
       where r.id = recepcion_id
         and public.ci_frm_permiso_obra(r.proyecto_id, array['almacen.ingreso', 'compra.registrar'])
    )
  )
  with check (
    exists (
      select 1
        from public.ci_recepciones_campo r
       where r.id = recepcion_id
         and public.ci_frm_permiso_obra(r.proyecto_id, array['almacen.ingreso', 'compra.registrar'])
    )
  );

create policy ci_recepciones_campo_lineas_delete on public.ci_recepciones_campo_lineas
  for delete to authenticated
  using (
    exists (
      select 1
        from public.ci_recepciones_campo r
       where r.id = recepcion_id
         and public.ci_frm_permiso_obra(r.proyecto_id, array['almacen.ingreso', 'compra.registrar'])
    )
  );

-- ── ci_notas_precargadas ────────────────────────────────────────────────────
alter table public.ci_notas_precargadas enable row level security;

drop policy if exists ci_notas_precargadas_authenticated on public.ci_notas_precargadas;
drop policy if exists ci_notas_precargadas_select on public.ci_notas_precargadas;
drop policy if exists ci_notas_precargadas_insert on public.ci_notas_precargadas;
drop policy if exists ci_notas_precargadas_update on public.ci_notas_precargadas;
drop policy if exists ci_notas_precargadas_delete on public.ci_notas_precargadas;

create policy ci_notas_precargadas_select on public.ci_notas_precargadas
  for select to authenticated
  using (
    public.ci_frm_permiso_obra(
      proyecto_id,
      array['almacen.ingreso', 'compra.registrar', 'almacen.despacho', 'almacen.cuarentena']
    )
  );

create policy ci_notas_precargadas_insert on public.ci_notas_precargadas
  for insert to authenticated
  with check (
    public.ci_frm_permiso_obra(proyecto_id, array['almacen.ingreso', 'compra.registrar'])
  );

create policy ci_notas_precargadas_update on public.ci_notas_precargadas
  for update to authenticated
  using (
    public.ci_frm_permiso_obra(proyecto_id, array['almacen.ingreso', 'compra.registrar'])
  )
  with check (
    public.ci_frm_permiso_obra(proyecto_id, array['almacen.ingreso', 'compra.registrar'])
  );

create policy ci_notas_precargadas_delete on public.ci_notas_precargadas
  for delete to authenticated
  using (
    public.ci_frm_permiso_obra(proyecto_id, array['almacen.ingreso', 'compra.registrar'])
  );

revoke all on public.ci_recepciones_campo from anon;
revoke all on public.ci_recepciones_campo_lineas from anon;
revoke all on public.ci_notas_precargadas from anon;

-- Enlace FRM↔procura: ya no es ejecutable con la sesión del navegador.
revoke execute on function public.ci_enlazar_frm_con_compra_procura(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.ci_enlazar_frm_con_compra_procura(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
