-- Parada / punto de encuentro del transporte gratuito (cláusula SEXTA del contrato laboral PDF), por proyecto.

alter table public.ci_proyectos
  add column if not exists punto_encuentro_transporte_contrato text;

comment on column public.ci_proyectos.punto_encuentro_transporte_contrato is
  'Texto que completa la frase «desde el punto de encuentro … hasta el sitio de la obra» en la SEXTA del PDF estructurado. Si está vacío se usa el valor histórico (sector Jorge Coll, Maneiro).';
