-- PGRST204: "Could not find the 'title' column" (tabla mínima o sin migración 031).

alter table public.recruitment_needs
  add column if not exists title text not null default 'Vacante';

comment on column public.recruitment_needs.title is
  'Título de la vacante; obligatorio para POST /api/recruitment/needs.';

update public.recruitment_needs
set title = 'Vacante'
where title is null or btrim(title) = '';

notify pgrst, 'reload schema';
