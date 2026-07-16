-- Campos de fecha/hora explícitos, placa (foto tanque/camión) y medición (foto prueba) vía IA.

alter table public.registro_agua_obrero
  add column if not exists registrado_en timestamptz not null default now();

alter table public.registro_agua_obrero
  add column if not exists placa_vehiculo text;

alter table public.registro_agua_obrero
  add column if not exists medicion_agua numeric(15, 4);

alter table public.registro_agua_obrero
  add column if not exists unidad_medicion text;

alter table public.registro_agua_obrero
  add column if not exists detalle_medicion text;

alter table public.registro_agua_obrero
  add column if not exists extraccion_ia jsonb not null default '{}'::jsonb;

update public.registro_agua_obrero
set registrado_en = created_at
where registrado_en is distinct from created_at;

comment on column public.registro_agua_obrero.registrado_en is
  'Fecha y hora del registro en el ERP (momento de guardar las dos fotos).';
comment on column public.registro_agua_obrero.placa_vehiculo is
  'Placa del camión/tanque extraída por IA de foto_tanque_url.';
comment on column public.registro_agua_obrero.medicion_agua is
  'Valor numérico de medición de agua (litros, m³, % nivel, etc.) según foto de prueba.';
comment on column public.registro_agua_obrero.extraccion_ia is
  'JSON con confianza, notas y respuesta cruda de Gemini.';

create index if not exists idx_registro_agua_obrero_registrado_en
  on public.registro_agua_obrero (registrado_en desc);

notify pgrst, 'reload schema';
