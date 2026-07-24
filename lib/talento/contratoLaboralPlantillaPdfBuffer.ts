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

/** Referencia expediente AÑO-NNNN (misma lógica que la API de PDF registro). */
export async function expedienteRefContratoLaboralRegistro(
  supabase: SupabaseClient,
  contratoId: string,
): Promise<string> {
  const nowYear = new Date().getFullYear();
  const { data: ctr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,created_at,obra_id,proyecto_id')
    .eq('id', contratoId)
    .maybeSingle();

  const c = ctr as
    | { id: string; created_at?: string | null; obra_id?: string | null; proyecto_id?: string | null }
    | null;
  if (!c) return `${nowYear}-0001`;

  const sitioId = String(c.obra_id ?? c.proyecto_id ?? '').trim();
  const createdAt = String(c.created_at ?? '').trim();
  const year = createdAt ? new Date(createdAt).getFullYear() : nowYear;
  if (!sitioId || !Number.isFinite(year)) return `${nowYear}-0001`;

  const { data: rows } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,created_at')
    .or(`obra_id.eq.${sitioId},proyecto_id.eq.${sitioId}`);

  const sameYear = ((rows ?? []) as Array<{ id?: string; created_at?: string | null }>)
    .filter((r) => {
      const d = new Date(String(r.created_at ?? ''));
      return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
    })
    .sort((a, b) => new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime());

  const idx = sameYear.findIndex((r) => String(r.id ?? '') === c.id);
  const seq = String(idx >= 0 ? idx + 1 : sameYear.length || 1).padStart(4, '0');
  return `${year}-${seq}`;
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
