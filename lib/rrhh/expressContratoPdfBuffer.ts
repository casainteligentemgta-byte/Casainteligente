import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarPropsContratoObreroPdfExpress,
  type ContratoExpressManualInput,
} from '@/lib/talento/contratoObreroPdfContext';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';
import {
  domicilioContratoObrero,
  estadoCivilContratoObrero,
  nacionalidadDesdeCedula,
  trabajadorFemeninoDesdeEstadoCivil,
} from '@/lib/talento/cedulaAuth';
import { resolverCodigoExpedienteContrato } from '@/lib/talento/codigoExpedienteContrato';
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
  pdf_storage_path?: string | null;
  expediente_codigo?: string | null;
};

function manualDesdeExpressRow(row: ExpressRow): ContratoExpressManualInput {
  const cedula = String(row.obrero_cedula ?? '').trim();
  const estadoCivil = estadoCivilContratoObrero(null);
  const femenino = trabajadorFemeninoDesdeEstadoCivil(estadoCivil);
  return {
    obreroNombre: String(row.obrero_nombre ?? '').trim(),
    obreroCedula: cedula,
    obreroDireccion: domicilioContratoObrero(row.obrero_direccion),
    horarioSemanalTexto: row.horario_semanal_texto?.trim() || null,
    nacionalidad: nacionalidadDesdeCedula(cedula, femenino) ?? (femenino ? 'venezolana' : 'venezolano'),
    estadoCivil,
    bonoManualUsd:
      row.bono_manual_usd != null && Number.isFinite(Number(row.bono_manual_usd))
        ? Number(row.bono_manual_usd)
        : null,
  };
}

export async function generarBufferContratoExpressPdf(
  supabase: SupabaseClient,
  expressId: string,
): Promise<
  | { ok: true; buf: Buffer; filename: string; expediente_codigo: string }
  | { ok: false; error: string }
> {
  const id = expressId.trim();
  if (!id) return { ok: false, error: 'Falta id de contrato express.' };

  const { data, error } = await supabase
    .from('ci_contratos_express')
    .select(
      'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_cedula,obrero_direccion,horario_semanal_texto,bono_manual_usd,pdf_storage_path,expediente_codigo',
    )
    .eq('id', id)
    .maybeSingle();

  let row: ExpressRow;
  if (error && /expediente_codigo|42703|column|schema cache/i.test(error.message)) {
    const fallback = await supabase
      .from('ci_contratos_express')
      .select(
        'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_cedula,obrero_direccion,horario_semanal_texto,bono_manual_usd,pdf_storage_path',
      )
      .eq('id', id)
      .maybeSingle();
    if (fallback.error) return { ok: false, error: fallback.error.message };
    if (!fallback.data) return { ok: false, error: 'Contrato express no encontrado.' };
    row = fallback.data as ExpressRow;
  } else if (error) {
    return { ok: false, error: error.message };
  } else if (!data) {
    return { ok: false, error: 'Contrato express no encontrado.' };
  } else {
    row = data as ExpressRow;
  }

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

  let expedienteLabel = String(row.expediente_codigo ?? '').trim();
  if (!expedienteLabel) {
    expedienteLabel = await resolverCodigoExpedienteContrato(supabase, {
      proyectoId,
      fecha: new Date(),
      expressId: id,
    });
  }

  try {
    const node = createElement(ContratoObreroPDF, {
      ...loaded.props,
      expedienteId: expedienteLabel,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    return {
      ok: true,
      buf,
      filename: `contrato-${expedienteLabel.replace(/[^A-Za-z0-9_-]+/g, '-')}.pdf`,
      expediente_codigo: expedienteLabel,
    };
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
    .select('id,pdf_storage_path,expediente_codigo')
    .eq('id', id)
    .maybeSingle();
  let existingRow = existing as { id?: string; pdf_storage_path?: string | null; expediente_codigo?: string | null } | null;
  if (selErr && /expediente_codigo|42703|column|schema cache/i.test(selErr.message)) {
    const fb = await admin
      .from('ci_contratos_express')
      .select('id,pdf_storage_path')
      .eq('id', id)
      .maybeSingle();
    if (fb.error) return { ok: false, error: fb.error.message, status: 500 };
    existingRow = fb.data as { id?: string; pdf_storage_path?: string | null } | null;
  } else if (selErr) {
    return { ok: false, error: selErr.message, status: 500 };
  }
  if (!existingRow) return { ok: false, error: 'Contrato no encontrado.', status: 404 };

  const built = await generarBufferContratoExpressPdf(admin, id);
  if (!built.ok) return { ok: false, error: built.error, status: 400 };

  const prevPath = String(existingRow.pdf_storage_path ?? '').trim();
  const storagePath = prevPath || `express/${id}/contrato-estructurado.pdf`;
  const codigoGuardado = String(existingRow.expediente_codigo ?? '').trim();
  const codigoNuevo = built.expediente_codigo.trim();

  const { error: upErr } = await admin.storage.from(BUCKET_CONTRATOS_OBREROS).upload(storagePath, built.buf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (upErr) {
    console.error('[regenerarYPersistirPdfContratoExpress] storage', upErr.message);
    return { ok: false, error: upErr.message, status: 500 };
  }

  const patch: Record<string, string> = {};
  if (!prevPath || prevPath !== storagePath) patch.pdf_storage_path = storagePath;
  if (!codigoGuardado && codigoNuevo) patch.expediente_codigo = codigoNuevo;

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await admin
      .from('ci_contratos_express')
      .update(patch as never)
      .eq('id', id);
    if (updErr && /expediente_codigo|42703|column|schema cache/i.test(updErr.message)) {
      if (patch.pdf_storage_path) {
        const { error: upd2 } = await admin
          .from('ci_contratos_express')
          .update({ pdf_storage_path: patch.pdf_storage_path } as never)
          .eq('id', id);
        if (upd2) {
          console.error('[regenerarYPersistirPdfContratoExpress] update path', upd2.message);
          return { ok: false, error: upd2.message, status: 500 };
        }
      }
      console.warn(
        '[regenerarYPersistirPdfContratoExpress] columna expediente_codigo ausente; aplique migración 311.',
      );
    } else if (updErr) {
      console.error('[regenerarYPersistirPdfContratoExpress] update', updErr.message);
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
