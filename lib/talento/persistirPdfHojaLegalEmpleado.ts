import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hojaVidaDesdeRow, nombreCompletoDesde } from '@/lib/talento/hojaVidaObreroCompleta';
import {
  firmaTrabajadorMetaDesdeRow,
  HojaDeVidaObreroLegalPdfDoc,
  type HojaVidaLegalPdfMeta,
} from '@/lib/talento/hojaVidaPdfLegal';
import { resolvePlanillaPatronoParaEmpleado } from '@/lib/talento/resolvePlanillaPatronoPdf';
import { friendlyStorageError } from '@/lib/supabase/friendlyStorageError';

export type VariantePdfHojaLegal = 'hoja_vida' | 'hoja_empleo';

export type PersistirPdfHojaLegalResult =
  | { ok: true; path: string; variante: VariantePdfHojaLegal; nombre: string }
  | { ok: false; error: string };

/**
 * Genera el PDF legal (hoja de vida o hoja de empleo) desde `ci_empleados`
 * y lo guarda en Storage (`contratos_obreros`).
 *
 * - Hoja de vida: al enviar el cuestionario del obrero.
 * - Hoja de empleo: al contratar (mismos datos + patrono/obra).
 */
export async function persistirPdfHojaLegalEmpleado(
  admin: SupabaseClient,
  empleadoId: string,
  variante: VariantePdfHojaLegal,
): Promise<PersistirPdfHojaLegalResult> {
  const id = empleadoId.trim();
  if (!id) return { ok: false, error: 'empleadoId requerido' };

  const { data: emp, error } = await admin.from('ci_empleados').select('*').eq('id', id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!emp) return { ok: false, error: 'Empleado no encontrado' };

  const row = emp as Record<string, unknown>;
  const str = (k: string) => String(row[k] ?? '').trim();
  const completa = hojaVidaDesdeRow(row);
  const nombre = nombreCompletoDesde(completa) || str('nombre_completo') || 'candidato';
  const emitidoEn = new Date().toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' });

  const meta: HojaVidaLegalPdfMeta = {
    emitidoEn,
    estadoProceso: str('estado_proceso'),
    rolBuscadoSistema: str('rol_buscado'),
    cargoCodigo: str('cargo_codigo'),
    cargoNombre: str('cargo_nombre'),
    firmaTrabajador: firmaTrabajadorMetaDesdeRow(row),
    documentVariant: variante,
  };

  if (variante === 'hoja_empleo') {
    meta.planillaPatrono = await resolvePlanillaPatronoParaEmpleado(admin, row);
  }

  try {
    const pdfNode = createElement(HojaDeVidaObreroLegalPdfDoc, { data: completa, meta });
    const blob = await pdf(pdfNode as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    const fileName = variante === 'hoja_vida' ? 'hoja-vida.pdf' : 'hoja-empleo.pdf';
    const path = `captacion/${id}/${fileName}`;

    const { error: upSt } = await admin.storage.from('contratos_obreros').upload(path, buf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (upSt) {
      return {
        ok: false,
        error: friendlyStorageError('contratos_obreros', upSt.message) || upSt.message,
      };
    }

    const patch: Record<string, string> =
      variante === 'hoja_vida'
        ? { hoja_vida_pdf_url: path, planilla_captacion_pdf_url: path }
        : { hoja_empleo_pdf_url: path };

    const { error: upEmp } = await admin.from('ci_empleados').update(patch as never).eq('id', id);
    if (upEmp) {
      // PDF ya en Storage; no fallar el flujo por columna aún no migrada.
      console.warn('[persistirPdfHojaLegalEmpleado] update columnas', upEmp.message);
    }

    return { ok: true, path, variante, nombre };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al generar PDF' };
  }
}
