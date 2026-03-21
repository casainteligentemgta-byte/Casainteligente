-- Ventas: el cliente puede ser una empresa O una persona (exactamente uno).
-- Ejecuta en Supabase DESPUÉS de 004_ventas.sql y 005_personas.sql
-- SQL Editor → New query → Pegar → Run

-- Permitir ventas sin empresa cuando hay persona
alter table public.ventas alter column empresa_id drop not null;

alter table public.ventas
  add column if not exists persona_id uuid references public.personas(id) on delete restrict;

-- Una venta debe referenciar empresa XOR persona
alter table public.ventas drop constraint if exists ventas_cliente_check;
alter table public.ventas add constraint ventas_cliente_check check (
  (empresa_id is not null and persona_id is null)
  or (empresa_id is null and persona_id is not null)
);

create index if not exists idx_ventas_persona_fecha on public.ventas (persona_id, fecha desc);
