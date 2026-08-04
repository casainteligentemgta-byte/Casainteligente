import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarPropsContratoObreroPdfExpress,
  type ContratoExpressManualInput,
} from '@/lib/talento/contratoObreroPdfContext';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';
import { estadoCivilContratoObrero, nacionalidadDesdeCedula } from '@/lib/talento/cedulaAuth';
import { BUCKET_CONTRATOS_OBREROS } from '@/lib/talento/contratoLaboralRegistroStorage';

type ExpressRow = {
  id: string;
  proyecto_id: string;
  config_nomina_id?: string | null;
  obrero_nombre?: string | null;
  obrero_cedula?: string | null;
  obrero_direccion?: string | null;
  horario_semanal_texto?: string | null;
  bono_manual_usd?: number | null;
  bono_manual_ves?: number | null;
  pdf_storage_path?: string | null;
};

function manualDesdeExpressRow(row: ExpressRow): ContratoExpressManualInput {
  const cedula = String(row.obrero_cedula ?? '').trim();
  return {
    obreroNombre: String(row.obrero_nombre ?? '').trim(),
    obreroCedula: cedula,
    obreroDireccion: row.obrero_direccion?.trim() || null,
    horarioSemanalTexto: row.horario_semanal_texto?.trim() || null,
    nacionalidad: nacionalidadDesdeCedula(cedula) ?? 'venezolana',
    estadoCivil: estadoCivilContratoObrero(null),
    bonoManualUsd:
      row.bono_manual_usd != null && Number.isFinite(Number(row.bono_manual_usd))
        ? Number(row.bono_manual_usd)
        : null,
  };
}

export async function generarBufferContratoExpressPdf(
  supabase: SupabaseClient,
  expressId: string,
): Promise<{ ok: true; buf: Buffer; filename: string } | { ok: false; error: string }> {
  const id = expressId.trim();
  if (!id) return { ok: false, error: 'Falta id de contrato express.' };

  const { data, error } = await supabase
    .from('ci_contratos_express')
    .select(
      'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_cedula,obrero_direccion,horario_semanal_texto,bono_manual_usd,bono_manual_ves,pdf_storage_path',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Contrato express no encontrado.' };

  const row = data as ExpressRow;
  const proyectoId = String(row.proyecto_id ?? '').trim();
  const configNominaId = String(row.config_nomina_id ?? '').trim();
  if (!proyectoId || !configNominaId) {
    return {
      ok: false,
      error:
        'Este contrato express no tiene proyecto o cargo (tabulador) vinculado; no se puede regenerar el PDF automáticamente.',
    };
  }

  const manual = manualDesdeExpressRow(row);
  if (!manual.obreroNombre || !manual.obreroCedula) {
    return { ok: false, error: 'Faltan nombre o cédula del obrero en el contrato express.' };
  }

  const loaded = await cargarPropsContratoObreroPdfExpress(supabase, proyectoId, configNominaId, manual);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const expedienteLabel = `EXPRESS-${id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  try {
    const node = createElement(ContratoObreroPDF, {
      ...loaded.props,
      expedienteId: expedienteLabel,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    return { ok: true, buf, filename: `contrato-express-${id.slice(0, 8)}.pdf` };
  } catch (e) {
    console.error('[generarBufferContratoExpressPdf]', e);
    return { ok: false, error: 'No se pudo generar el PDF del contrato express.' };
  }
}

/**
 * Regenera el PDF estructurado del contrato express y lo sobrescribe en Storage
 * (misma ruta o `express/{id}/contrato-estructurado.pdf`).
 */
export async function regenerarYPersistirPdfContratoExpress(
  admin: SupabaseClient,
  expressId: string,
): Promise<
  | { ok: true; pdf_storage_path: string; signed_url: string | null }
  | { ok: false; error: string; status: number }
> {
  const id = expressId.trim();
  if (!id) return { ok: false, error: 'Falta id de contrato.', status: 400 };

  const { data: existing, error: selErr } = await admin
    .from('ci_contratos_express')
    .select('id,pdf_storage_path')
    .eq('id', id)
    .maybeSingle();
  if (selErr) return { ok: false, error: selErr.message, status: 500 };
  if (!existing) return { ok: false, error: 'Contrato no encontrado.', status: 404 };

  const built = await generarBufferContratoExpressPdf(admin, id);
  if (!built.ok) return { ok: false, error: built.error, status: 400 };

  const prevPath = String((existing as { pdf_storage_path?: string | null }).pdf_storage_path ?? '').trim();
  const storagePath = prevPath || `express/${id}/contrato-estructurado.pdf`;

  const { error: upErr } = await admin.storage.from(BUCKET_CONTRATOS_OBREROS).upload(storagePath, built.buf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (upErr) {
    console.error('[regenerarYPersistirPdfContratoExpress] storage', upErr.message);
    return { ok: false, error: upErr.message, status: 500 };
  }

  if (!prevPath || prevPath !== storagePath) {
    const { error: updErr } = await admin
      .from('ci_contratos_express')
      .update({ pdf_storage_path: storagePath } as never)
      .eq('id', id);
    if (updErr) {
      console.error('[regenerarYPersistirPdfContratoExpress] update path', updErr.message);
      return { ok: false, error: updErr.message, status: 500 };
    }
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET_CONTRATOS_OBREROS)
    .createSignedUrl(storagePath, 60 * 30);
  if (signErr) {
    console.warn('[regenerarYPersistirPdfContratoExpress] signed url', signErr.message);
  }

  return {
    ok: true,
    pdf_storage_path: storagePath,
    signed_url: signed?.signedUrl ?? null,
  };
}
