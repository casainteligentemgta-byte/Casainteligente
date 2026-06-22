-- Rol Contador en bot de compras (viabilidad presupuestaria / revisión de fondos).

alter table public.ci_usuarios_sistema_telegram
  drop constraint if exists ci_usuarios_sistema_telegram_rol_check;

alter table public.ci_usuarios_sistema_telegram
  add constraint ci_usuarios_sistema_telegram_rol_check
  check (rol in ('Solicitante', 'Aprobador', 'Comprador', 'Administrador', 'Contador'));

comment on column public.ci_usuarios_sistema_telegram.rol is
  'Solicitante | Aprobador (PM) | Comprador | Contador (viabilidad presupuestaria) | Administrador (legacy alias contador).';

notify pgrst, 'reload schema';
