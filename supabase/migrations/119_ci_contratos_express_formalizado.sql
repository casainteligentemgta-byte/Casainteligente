-- Vínculo contrato express → expediente creado en ci_empleados (formalización).

alter table public.ci_contratos_express
  add column if not exists formalizado_empleado_id uuid references public.ci_empleados (id) on delete set null;

alter table public.ci_contratos_express
  add column if not exists formalizado_at timestamptz;

comment on column public.ci_contratos_express.formalizado_empleado_id is
  'Expediente creado desde este contrato express (flujo regular).';
comment on column public.ci_contratos_express.formalizado_at is
  'Marca de tiempo de la formalización.';

create index if not exists idx_ci_contratos_express_formalizado on public.ci_contratos_express (formalizado_empleado_id)
  where formalizado_empleado_id is not null;

notify pgrst, 'reload schema';
