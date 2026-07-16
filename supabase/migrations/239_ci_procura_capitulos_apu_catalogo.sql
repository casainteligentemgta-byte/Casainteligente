-- /procura (Telegram): capítulos alineados con Control de obra → Análisis APU.

update public.ci_compras_capitulos_maestro
set activo = false
where codigo in ('CAP-I', 'CAP-II', 'CAP-III', 'CAP-IV', 'CAP-V');

insert into public.ci_compras_capitulos_maestro (codigo, nombre, activo)
values
  ('01', 'Demolición y obras provisionales', true),
  ('02', 'Estructura', true),
  ('03', 'Albañilería', true),
  ('04', 'Instalaciones eléctricas', true),
  ('05', 'Instalaciones sanitarias', true),
  ('06', 'Pozo de agua', true),
  ('07', 'Piscina', true),
  ('08', 'Muro ciclópeo', true)
on conflict (codigo) do update
  set nombre = excluded.nombre,
      activo = true;

comment on table public.ci_compras_capitulos_maestro is
  'Catálogo maestro de capítulos de obra para procuras (alineado con APU Lulo: 01–08 + altas dinámicas).';
