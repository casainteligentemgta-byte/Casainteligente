-- Ciclo de firma electrónica → física en contratos obra + Realtime para dashboard.

alter table public.ci_contratos_empleado_obra
  add column if not exists estado_contrato text not null default 'generado',
  add column if not exists firmado_fisico_at timestamptz,
  add column if not exists proyecto_id uuid references public.ci_proyectos (id) on delete restrict;

comment on column public.ci_contratos_empleado_obra.estado_contrato is
  'generado | firmado_electronico | firmado_activo | … (widget RRHH entre electrónica y física).';
comment on column public.ci_contratos_empleado_obra.firmado_fisico_at is
  'Cuando RRHH confirma firma autógrafa + huella y activa el contrato.';

create index if not exists idx_ci_contratos_estado on public.ci_contratos_empleado_obra (estado_contrato);

-- Al guardar firma en ci_empleados, pasar contratos «generado» a «firmado_electronico».
create or replace function public.ci_empleados_propaga_firma_electronica_contrato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.firma_electronica_at is not null
     and (TG_OP = 'INSERT' or OLD.firma_electronica_at is distinct from NEW.firma_electronica_at) then
    update public.ci_contratos_empleado_obra c
    set estado_contrato = 'firmado_electronico'
    where c.empleado_id = NEW.id
      and c.estado_contrato = 'generado';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_ci_empleados_firma_propaga_contrato on public.ci_empleados;
create trigger trg_ci_empleados_firma_propaga_contrato
  after insert or update of firma_electronica_at on public.ci_empleados
  for each row
  execute function public.ci_empleados_propaga_firma_electronica_contrato();

-- Contratos ya existentes con firma en empleado pero estado «generado».
update public.ci_contratos_empleado_obra c
set estado_contrato = 'firmado_electronico'
from public.ci_empleados e
where e.id = c.empleado_id
  and e.firma_electronica_at is not null
  and c.estado_contrato = 'generado';

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ci_contratos_empleado_obra'
  ) then
    alter publication supabase_realtime add table public.ci_contratos_empleado_obra;
  end if;
exception
  when undefined_object then
    raise notice 'Publicación supabase_realtime no encontrada; habilita Realtime para ci_contratos_empleado_obra en el panel.';
end $$;

notify pgrst, 'reload schema';
