-- ci_empleados.celular (065 Gaceta): debe ser nullable; algunos entornos tenían NOT NULL manual.
-- Backfill desde telefono antes de inserts sin número (generar-link, examen anónimo).

alter table public.ci_empleados
  alter column celular drop not null;

update public.ci_empleados
set celular = coalesce(
  nullif(trim(celular), ''),
  nullif(trim(telefono), ''),
  'Pendiente RRHH'
)
where celular is null or trim(celular) = '';

comment on column public.ci_empleados.celular is
  'WhatsApp / móvil. «Pendiente RRHH» si el expediente se abrió solo con enlace de examen.';

notify pgrst, 'reload schema';
