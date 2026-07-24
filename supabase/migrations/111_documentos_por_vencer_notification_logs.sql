-- Vista para alertas de vencimiento (curso de seguridad u otros con expiry_date) y auditoría de envíos.

-- ─── Auditoría (Edge Function check-document-expiry) ───────────────────────
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null default 'check_document_expiry',
  documento_id uuid not null,
  alert_days int not null check (alert_days in (5, 15, 30)),
  sent_on date not null default ((now() at time zone 'America/Caracas')::date),
  recipient text not null,
  subject text,
  body text,
  created_at timestamptz not null default now(),
  unique (notification_type, documento_id, alert_days, sent_on)
);

create index if not exists idx_notification_logs_type_sent
  on public.notification_logs (notification_type, sent_on desc);

comment on table public.notification_logs is
  'Registro de notificaciones enviadas (p. ej. vencimiento de documentos); evita duplicados el mismo día por documento y ventana (5/15/30 días).';

alter table public.notification_logs enable row level security;

grant select, insert, update, delete on public.notification_logs to service_role;
grant select on public.notification_logs to authenticated;

-- ─── Vista: documentos con fecha de vencimiento ───────────────────────────
create or replace view public.documentos_por_vencer as
select
  pcd.id as documento_id,
  p.id as persona_id,
  apa.project_id as proyecto_id,
  p.full_name as nombre_obrero,
  coalesce(cp.nombre, 'Sin proyecto asignado') as proyecto_nombre,
  case pcd.document_kind
    when 'curso_seguridad' then 'Curso de Seguridad'
    when 'cedula' then 'Cédula'
    when 'otro' then 'Otro documento'
    else initcap(replace(pcd.document_kind, '_', ' '))
  end as document_type,
  pcd.expiry_date as fecha_vencimiento,
  (pcd.expiry_date - ((now() at time zone 'America/Caracas'))::date)::integer as dias_hasta_vencimiento
from public.person_candidate_documents pcd
inner join public.persons p on p.id = pcd.person_id
left join lateral (
  select pa.project_id
  from public.project_assignments pa
  where pa.person_id = p.id
    and pa.end_date is null
  order by coalesce(pa.start_date, pa.created_at) desc
  limit 1
) apa on true
left join public.ci_proyectos cp on cp.id = apa.project_id
where pcd.validated_at is not null
  and pcd.expiry_date is not null;

comment on view public.documentos_por_vencer is
  'Documentos validados con expiry_date; dias_hasta_vencimiento en zona America/Caracas.';

grant select on public.documentos_por_vencer to anon, authenticated, service_role;

notify pgrst, 'reload schema';
