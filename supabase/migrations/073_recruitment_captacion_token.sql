-- Enlace único /registro/[token] para captación automática (WhatsApp).

alter table public.recruitment_needs
  add column if not exists captacion_token text;

create unique index if not exists idx_recruitment_needs_captacion_token
  on public.recruitment_needs (captacion_token)
  where captacion_token is not null and length(trim(captacion_token)) > 0;

comment on column public.recruitment_needs.captacion_token is
  'Token opaco para URL pública /registro/[token] (vacante + proyecto módulo).';

notify pgrst, 'reload schema';
