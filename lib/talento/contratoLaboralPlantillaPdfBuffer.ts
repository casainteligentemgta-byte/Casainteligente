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
import {
  codigoCortoDesdeNombre,
  formatearExpedienteContrato,
} from '@/lib/talento/nomenclaturaExpedienteContrato';

/** Referencia expediente AÑO-MES-ENTIDAD-OBRA-Número (misma nomenclatura que express). */
export async function expedienteRefContratoLaboralRegistro(
  supabase: SupabaseClient,
  contratoId: string,
): Promise<string> {
  const now = new Date();
  const { data: ctr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,created_at,obra_id,proyecto_id,fecha_ingreso,fecha_firma_contrato,empleado_id')
    .eq('id', contratoId)
    .maybeSingle();

  const c = ctr as
    | {
        id: string;
        created_at?: string | null;
        obra_id?: string | null;
        proyecto_id?: string | null;
        fecha_ingreso?: string | null;
        fecha_firma_contrato?: string | null;
        empleado_id?: string | null;
      }
    | null;
  if (!c) {
    return formatearExpedienteContrato({
      anio: now.getFullYear(),
      mes: now.getMonth() + 1,
      entidadCodigo: 'ENT',
      obraCodigo: 'OBRA',
      numero: 1,
    });
  }

  const sitioId = String(c.obra_id ?? c.proyecto_id ?? '').trim();
  const iso = String(c.fecha_firma_contrato ?? c.fecha_ingreso ?? c.created_at ?? '').trim();
  const day = iso.includes('T') ? iso.slice(0, 10) : iso.slice(0, 10);
  let anio = now.getFullYear();
  let mes = now.getMonth() + 1;
  if (/^\d{4}-\d{2}/.test(day)) {
    anio = Number(day.slice(0, 4));
    mes = Number(day.slice(5, 7));
  }

  let obraNombre = '';
  let entidadId: string | null = null;
  if (sitioId) {
    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('nombre,obra_codigo,entidad_id')
      .eq('id', sitioId)
      .maybeSingle();
    const p = proy as {
      nombre?: string | null;
      obra_codigo?: string | null;
      entidad_id?: string | null;
    } | null;
    obraNombre = (p?.obra_codigo ?? '').trim() || (p?.nombre ?? '').trim();
    entidadId = (p?.entidad_id ?? '').trim() || null;
  }

  let entidadNombre = '';
  if (entidadId) {
    const { data: ent } = await supabase
      .from('ci_entidades')
      .select('nombre,nombre_legal')
      .eq('id', entidadId)
      .maybeSingle();
    const e = ent as { nombre?: string | null; nombre_legal?: string | null } | null;
    entidadNombre = (e?.nombre ?? '').trim() || (e?.nombre_legal ?? '').trim();
  }

  let numero = 1;
  if (sitioId) {
    const { data: rows } = await supabase
      .from('ci_contratos_empleado_obra')
      .select('id,created_at,fecha_ingreso,fecha_firma_contrato')
      .or(`obra_id.eq.${sitioId},proyecto_id.eq.${sitioId}`);

    const same = ((rows ?? []) as Array<{
      id?: string;
      created_at?: string | null;
      fecha_ingreso?: string | null;
      fecha_firma_contrato?: string | null;
    }>)
      .map((r) => {
        const raw = String(r.fecha_firma_contrato ?? r.fecha_ingreso ?? r.created_at ?? '');
        const d = raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10);
        const y = /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : NaN;
        const m = /^\d{4}-\d{2}/.test(d) ? Number(d.slice(5, 7)) : NaN;
        const t = new Date(raw.includes('T') ? raw : `${d}T12:00:00`).getTime();
        return { id: String(r.id ?? ''), y, m, t: Number.isNaN(t) ? 0 : t };
      })
      .filter((x) => x.y === anio && x.m === mes)
      .sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));

    const idx = same.findIndex((x) => x.id === c.id);
    numero = idx >= 0 ? idx + 1 : same.length || 1;
  }

  return formatearExpedienteContrato({
    anio,
    mes,
    entidadCodigo: codigoCortoDesdeNombre(entidadNombre || 'ENT', 6),
    obraCodigo: codigoCortoDesdeNombre(obraNombre || 'OBRA', 8),
    numero,
  });
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
