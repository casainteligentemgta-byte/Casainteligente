-- Egresos CCO: persistir Monto Pagado (campo V4 / CSV maestro).
alter table public.contabilidad_compras
  add column if not exists monto_pagado_usd numeric(18, 4);

comment on column public.contabilidad_compras.monto_pagado_usd is
  'Monto pagado en USD (CCO V4 / CSV maestro). Null = no informado; UI puede inferir por cco_estado.';

notify pgrst, 'reload schema';
