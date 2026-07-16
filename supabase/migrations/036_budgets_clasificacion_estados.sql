-- Budgets: clasificación comercial explícita (sin pendiente/archivado).

alter table public.budgets
  alter column status set default 'no_enviado';

update public.budgets
set status = case
  when status = 'pendiente' then 'no_enviado'
  when status = 'rechazado' then 'no_aprobado'
  else status
end
where status in ('pendiente', 'rechazado');

alter table public.budgets
  drop constraint if exists budgets_status_check;

alter table public.budgets
  add constraint budgets_status_check
  check (status in ('no_enviado', 'enviado', 'aprobado', 'no_aprobado', 'cobrado', 'pagado'));
