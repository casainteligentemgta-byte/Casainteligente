import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarFuentesContratoObreroPdf } from '@/lib/talento/contratoObreroPdfContext';
import { ContratoLaboralObreroPdfDocument } from '@/lib/talento/ContratoLaboralObreroPdfStub';
import {
  compilarPlantillaContratoObrero,
  construirMapaVariablesContratoObrero,
  type DatoContratoFaltante,
} from '@/lib/talento/plantillaContratoObreroCompile';
import { obtenerCuerpoPlantillaContratoObrero } from '@/lib/talento/plantillaContratoObreroRepo';

/** Expediente = cédula del trabajador (obra + registro en entidad). */
export async function expedienteRefContratoLaboralRegistro(
  supabase: SupabaseClient,
  contratoId: string,
): Promise<string> {
  let { data: ctr, error: sel } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,empleado_id,expediente_cedula')
    .eq('id', contratoId)
    .maybeSingle();
  if (sel && /expediente_cedula|42703|schema cache|column/i.test(sel.message)) {
    const retry = await supabase
      .from('ci_contratos_empleado_obra')
      .select('id,empleado_id')
      .eq('id', contratoId)
      .maybeSingle();
    ctr = retry.data;
  }

  const c = ctr as
    | { id: string; empleado_id?: string | null; expediente_cedula?: string | null }
    | null;
  const guardado = String(c?.expediente_cedula ?? '').trim();
  if (guardado) return guardado;
  const empId = String(c?.empleado_id ?? '').trim();
  if (!empId) return '';
  const { construirExpedienteRefPorEmpleado } = await import('@/lib/talento/contratoExpedienteRef');
  return construirExpedienteRefPorEmpleado(supabase, empId);
}

export type BuildContratoLaboralPlantillaPdfResult =
  | { ok: true; buffer: Buffer; expedienteRef: string; faltantes: DatoContratoFaltante[] }
  | { ok: false; error: string };

/**
 * Genera el PDF del contrato (plantilla biblioteca + variables), igual que GET /api/registro/contrato-laboral/pdf.
 */
export async function buildContratoLaboralPlantillaPdfBuffer(
  supabase: SupabaseClient,
  contratoId: string,
): Promise<BuildContratoLaboralPlantillaPdfResult> {
  const fu = await cargarFuentesContratoObreroPdf(supabase, contratoId);
  if (!fu.ok) {
    return { ok: false, error: fu.error };
  }
  let cuerpo: string;
  try {
    cuerpo = await obtenerCuerpoPlantillaContratoObrero(supabase);
  } catch (e) {
    console.error('[buildContratoLaboralPlantillaPdfBuffer] plantilla', e);
    return { ok: false, error: 'No se pudo cargar la plantilla del contrato' };
  }
  const mapa = construirMapaVariablesContratoObrero(fu.fuentes);
  const { texto, faltantes } = compilarPlantillaContratoObrero(cuerpo, mapa);
  const pie =
    faltantes.length > 0
      ? 'Revise los recuadros [… COMPLETAR …] con su planilla de empleo o solicite ayuda a RRHH antes de firmar.'
      : null;
  const expedienteRef = await expedienteRefContratoLaboralRegistro(supabase, contratoId);
  try {
    const node = createElement(ContratoLaboralObreroPdfDocument, {
      expedienteId: expedienteRef,
      titulo: 'CONTRATO INDIVIDUAL DE TRABAJO',
      cuerpoTexto: texto,
      pieLegal: pie,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    return { ok: true, buffer, expedienteRef, faltantes };
  } catch (e) {
    console.error('[buildContratoLaboralPlantillaPdfBuffer]', e);
    return { ok: false, error: 'No se pudo generar el PDF' };
  }
}
