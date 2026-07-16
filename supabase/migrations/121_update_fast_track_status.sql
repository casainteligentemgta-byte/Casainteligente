-- Estado fast-track: bandera `formalizado` en `ci_contratos_express`.
-- (En este repo no existe `ci_contratos_fast`; el expediente vinculado sigue en `formalizado_empleado_id`, migración 119.)

alter table public.ci_contratos_express
  add column if not exists formalizado boolean not null default false;

comment on column public.ci_contratos_express.formalizado is
  'Indica si los datos ya fueron migrados a ci_empleados (true cuando formalizado_empleado_id no es null).';

update public.ci_contratos_express
set formalizado = true
where formalizado_empleado_id is not null
  and formalizado = false;

notify pgrst, 'reload schema';
