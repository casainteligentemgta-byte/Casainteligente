-- 404 · Facturas Telegram por álbum (varias fotos = una carga) y aviso de error al cargador.
-- Aditivo. Idempotente. NO aplica cambios en producción por sí sola: hay que correrla
-- en el SQL Editor / pipeline de migraciones cuando el dueño lo apruebe.

alter table public.ci_facturas_canal_pendientes
  add column if not exists telegram_media_group_id text,
  add column if not exists document_parts jsonb not null default '[]'::jsonb,
  add column if not exists album_last_part_at timestamptz,
  add column if not exists aviso_error_enviado_at timestamptz,
  add column if not exists requiere_revision boolean not null default false;

comment on column public.ci_facturas_canal_pendientes.telegram_media_group_id is
  'media_group_id de Telegram: varias fotos del mismo álbum se agrupan en esta fila.';
comment on column public.ci_facturas_canal_pendientes.document_parts is
  'Partes de la carga [{orden, storage_path, mime_type, file_name, file_id, telegram_message_id}].';
comment on column public.ci_facturas_canal_pendientes.album_last_part_at is
  'Última foto recibida del álbum; el OCR espera un debounce sobre este instante.';
comment on column public.ci_facturas_canal_pendientes.aviso_error_enviado_at is
  'Evita avisos Telegram duplicados al cargador por la misma carga.';
comment on column public.ci_facturas_canal_pendientes.requiere_revision is
  'Álbum incompleto o totales que no cuadran: el cargador debe reenviar la parte que falta.';

create unique index if not exists idx_ci_facturas_canal_media_group
  on public.ci_facturas_canal_pendientes (telegram_media_group_id)
  where telegram_media_group_id is not null;

-- Append atómico de una parte del álbum (varias fotos llegan como updates concurrentes).
-- SECURITY INVOKER: la llama el webhook con service_role (bypassa RLS). No es definer.
create or replace function public.ci_agregar_parte_album_factura(
  p_media_group_id text,
  p_parte jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_msg text;
  v_file text;
begin
  if p_media_group_id is null or length(trim(p_media_group_id)) = 0 then
    return null;
  end if;

  v_msg := nullif(trim(p_parte->>'telegram_message_id'), '');
  v_file := nullif(trim(p_parte->>'file_id'), '');

  update public.ci_facturas_canal_pendientes
  set
    document_parts = case
      when exists (
        select 1
        from jsonb_array_elements(coalesce(document_parts, '[]'::jsonb)) e
        where (v_msg is not null and e->>'telegram_message_id' = v_msg)
           or (v_file is not null and e->>'file_id' = v_file)
      ) then coalesce(document_parts, '[]'::jsonb)
      else coalesce(document_parts, '[]'::jsonb) || jsonb_build_array(p_parte)
    end,
    album_last_part_at = now(),
    updated_at = now()
  where telegram_media_group_id = p_media_group_id
    and estado in ('recibido', 'pendiente', 'error')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ci_agregar_parte_album_factura(text, jsonb) from public, anon, authenticated;
grant execute on function public.ci_agregar_parte_album_factura(text, jsonb) to service_role;

comment on function public.ci_agregar_parte_album_factura(text, jsonb) is
  'Agrega una foto/PDF a la carga Telegram del álbum (idempotente por file_id / message_id).';

notify pgrst, 'reload schema';
