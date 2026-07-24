-- Unificación: obras Talento (ci_obras) → ci_proyectos (tipo_proyecto = 'talento').
-- Compatibilidad lectura: VIEW public.ci_obras; tabla física → ci_obras_deprecated.
-- Idempotente: re-ejecutar omite pasos ya aplicados.

-- ── 1) Tipo enumerado ─────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'tipo_proyecto_ci' and n.nspname = 'public'
  ) then
    create type public.tipo_proyecto_ci as enum ('integral', 'talento');
  end if;
end $$;

-- ── 2) Columnas en ci_proyectos ───────────────────────────────────
alter table public.ci_proyectos
  add column if not exists tipo_proyecto public.tipo_proyecto_ci not null default 'integral';

alter table public.ci_proyectos
  add column if not exists legacy_obra_id uuid;

comment on column public.ci_proyectos.tipo_proyecto is
  'integral = módulo integral; talento = obra / nómina (ex ci_obras).';
comment on column public.ci_proyectos.legacy_obra_id is
  'UUID en ci_obras antes de unificar (trazabilidad).';

alter table public.ci_proyectos add column if not exists obra_codigo text;
alter table public.ci_proyectos add column if not exists obra_cliente text;
alter table public.ci_proyectos add column if not exists obra_ubicacion text;
alter table public.ci_proyectos add column if not exists obra_fecha_inicio date;
alter table public.ci_proyectos add column if not exists obra_fecha_entrega date;
alter table public.ci_proyectos add column if not exists obra_avance_pct numeric(5, 2);
alter table public.ci_proyectos add column if not exists obra_precio_venta_usd numeric(14, 2);
alter table public.ci_proyectos add column if not exists obra_penalizacion_diaria_usd numeric(14, 2);
alter table public.ci_proyectos add column if not exists obra_estado_legacy text;
alter table public.ci_proyectos add column if not exists obra_fecha_cierre timestamptz;
alter table public.ci_proyectos add column if not exists obra_notas text;
alter table public.ci_proyectos add column if not exists obra_presupuesto_ves numeric(14, 2);
alter table public.ci_proyectos add column if not exists obra_presupuesto_mano_obra_ves numeric(14, 2);
alter table public.ci_proyectos add column if not exists obra_fondo_reserva_liquidacion_ves numeric(14, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'ci_proyectos' and c.conname = 'ci_proyectos_obra_estado_legacy_check'
  ) then
    alter table public.ci_proyectos
      add constraint ci_proyectos_obra_estado_legacy_check
      check (obra_estado_legacy is null or obra_estado_legacy in ('activa', 'cerrada'));
  end if;
end $$;

create unique index if not exists idx_ci_proyectos_obra_codigo_unique
  on public.ci_proyectos (obra_codigo)
  where obra_codigo is not null;

create index if not exists idx_ci_proyectos_tipo on public.ci_proyectos (tipo_proyecto);

-- ── 3) Copiar filas Talento a ci_proyectos (mismo id) ──────────────
do $$
declare
  src regclass;
begin
  if to_regclass('public.ci_obras') is not null
     and not exists (select 1 from pg_views where schemaname = 'public' and viewname = 'ci_obras') then
    src := 'public.ci_obras'::regclass;
  elsif to_regclass('public.ci_obras_deprecated') is not null then
    src := 'public.ci_obras_deprecated'::regclass;
  else
    return;
  end if;

  execute format($fmt$
    insert into public.ci_proyectos (
      id, customer_id, budget_id, nombre, estado, ubicacion_texto, lat, lng,
      monto_aproximado, moneda, observaciones, created_at, updated_at, entidad_id,
      budgets_adicionales, tipo_proyecto, legacy_obra_id,
      obra_codigo, obra_cliente, obra_ubicacion, obra_fecha_inicio, obra_fecha_entrega,
      obra_avance_pct, obra_precio_venta_usd, obra_penalizacion_diaria_usd,
      obra_estado_legacy, obra_fecha_cierre, obra_notas,
      obra_presupuesto_ves, obra_presupuesto_mano_obra_ves, obra_fondo_reserva_liquidacion_ves
    )
    select
      o.id,
      null::uuid,
      null::uuid,
      o.nombre,
      case when o.estado = 'cerrada' then 'cerrado' else 'ejecucion' end::text,
      coalesce(nullif(trim(o.ubicacion), ''), o.nombre),
      null::numeric,
      null::numeric,
      coalesce(o.precio_venta_usd, 0)::numeric(14, 2),
      'USD'::text,
      o.notas,
      o.created_at,
      o.updated_at,
      o.entidad_id,
      '[]'::jsonb,
      'talento'::public.tipo_proyecto_ci,
      o.id,
      o.codigo,
      o.cliente,
      o.ubicacion,
      o.fecha_inicio,
      o.fecha_entrega_prometida,
      o.avance_porcentaje,
      o.precio_venta_usd,
      o.penalizacion_diaria_usd,
      o.estado,
      o.fecha_cierre,
      o.notas,
      o.presupuesto_ves,
      o.presupuesto_mano_obra_ves,
      o.fondo_reserva_liquidacion_ves
    from %s o
    where not exists (select 1 from public.ci_proyectos p where p.id = o.id)
    on conflict (id) do nothing
  $fmt$, src);
end $$;

-- ── 4) Repuntar FKs: de ci_obras / deprecated → ci_proyectos ───────
do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid in (
        select cl.oid
        from pg_class cl
        join pg_namespace n on n.oid = cl.relnamespace
        where n.nspname = 'public'
          and cl.relkind = 'r'
          and cl.relname in ('ci_obras', 'ci_obras_deprecated')
      )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.recruitment_needs
  drop constraint if exists recruitment_needs_proyecto_id_fkey;
alter table public.recruitment_needs
  add constraint recruitment_needs_proyecto_id_fkey
  foreign key (proyecto_id) references public.ci_proyectos (id) on delete restrict;

alter table public.ci_materiales_obra
  drop constraint if exists ci_materiales_obra_obra_id_fkey;
alter table public.ci_materiales_obra
  add constraint ci_materiales_obra_obra_id_fkey
  foreign key (obra_id) references public.ci_proyectos (id) on delete cascade;

alter table public.ci_obra_empleados
  drop constraint if exists ci_obra_empleados_obra_id_fkey;
alter table public.ci_obra_empleados
  add constraint ci_obra_empleados_obra_id_fkey
  foreign key (obra_id) references public.ci_proyectos (id) on delete cascade;

alter table public.ci_contratos_empleado_obra
  drop constraint if exists ci_contratos_empleado_obra_obra_id_fkey;
alter table public.ci_contratos_empleado_obra
  add constraint ci_contratos_empleado_obra_obra_id_fkey
  foreign key (obra_id) references public.ci_proyectos (id) on delete restrict;

-- ── 5) Renombrar tabla física (solo si aún existe como tabla) ──────
do $$
begin
  if exists (
    select 1 from pg_tables t
    where t.schemaname = 'public' and t.tablename = 'ci_obras'
  ) then
    alter table public.ci_obras rename to ci_obras_deprecated;
  end if;
end $$;

-- ── 6) Vista compatibilidad (lectura) ─────────────────────────────
drop view if exists public.ci_obras;

create view public.ci_obras as
select
  p.id,
  p.obra_codigo as codigo,
  p.nombre,
  p.obra_ubicacion as ubicacion,
  p.obra_cliente as cliente,
  p.obra_fecha_inicio as fecha_inicio,
  p.obra_fecha_entrega as fecha_entrega_prometida,
  p.obra_avance_pct as avance_porcentaje,
  p.obra_precio_venta_usd as precio_venta_usd,
  p.obra_penalizacion_diaria_usd as penalizacion_diaria_usd,
  p.obra_estado_legacy as estado,
  p.obra_fecha_cierre as fecha_cierre,
  p.obra_notas as notas,
  p.obra_presupuesto_ves as presupuesto_ves,
  p.obra_presupuesto_mano_obra_ves as presupuesto_mano_obra_ves,
  p.obra_fondo_reserva_liquidacion_ves as fondo_reserva_liquidacion_ves,
  p.entidad_id,
  p.created_at,
  p.updated_at
from public.ci_proyectos p
where p.tipo_proyecto = 'talento';

comment on view public.ci_obras is
  'Lectura legacy: filas Talento en ci_proyectos. Altas/ediciones: usar ci_proyectos con tipo_proyecto = talento.';

grant select on public.ci_obras to anon, authenticated, service_role;

notify pgrst, 'reload schema';
