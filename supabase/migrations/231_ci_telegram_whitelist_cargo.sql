-- Cargo / función del autorizado en lista blanca Telegram.

alter table public.ci_telegram_whitelist
  add column if not exists cargo varchar(100);

comment on column public.ci_telegram_whitelist.cargo is
  'Cargo o función del contacto (ej. Comprador, Residente, Aprobador).';

-- Migrar notas previas usadas como cargo en altas manuales
update public.ci_telegram_whitelist
set cargo = left(trim(notas), 100)
where cargo is null
  and notas is not null
  and trim(notas) <> ''
  and origen = 'manual';

notify pgrst, 'reload schema';
