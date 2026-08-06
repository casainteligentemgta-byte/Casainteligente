import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarPropsContratoObreroPdfExpress,
  type ContratoExpressManualInput,
} from '@/lib/talento/contratoObreroPdfContext';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';
import { BUCKET_CONTRATOS_OBREROS } from '@/lib/talento/contratoLaboralRegistroStorage';
import { estadoCivilContratoObrero } from '@/lib/talento/cedulaAuth';
import { faseTecnicaDefaultProyecto } from '@/lib/talento/fasesTecnicasContrato';
import {
  buscarEstadoCivilExpedientePorCedula,
  resolverEstadoCivilContrato,
} from '@/lib/talento/estadoCivilDesdeHojaVida';

export type ExpressRowPdf = {
  id: string;
  proyecto_id: string;
  config_nomina_id?: string | null;
  obrero_nombre?: string | null;
  obrero_nombres?: string | null;
  obrero_apellidos?: string | null;
  obrero_cedula?: string | null;
  obrero_direccion?: string | null;
  horario_semanal_texto?: string | null;
  bono_manual_usd?: number | null;
  bono_manual_ves?: number | null;
  pdf_storage_path?: string | null;
  estado_civil?: string | null;
  nacionalidad?: string | null;
  fecha_ingreso?: string | null;
  objeto_contrato?: string | null;
  jornada_trabajo?: string | null;
  obrero_municipio_residencia?: string | null;
  obrero_estado_residencia?: string | null;
};

const SELECT_FULL =
  'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_nombres,obrero_apellidos,obrero_cedula,obrero_direccion,horario_semanal_texto,bono_manual_usd,bono_manual_ves,pdf_storage_path,estado_civil,nacionalidad,fecha_ingreso,objeto_contrato,jornada_trabajo,obrero_municipio_residencia,obrero_estado_residencia';

const SELECT_BASE =
  'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_cedula,obrero_direccion,horario_semanal_texto,bono_manual_usd,bono_manual_ves,pdf_storage_path';

function strOpt(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

export function manualDesdeExpressRow(row: ExpressRowPdf): ContratoExpressManualInput {
  const nombres = strOpt(row.obrero_nombres);
  const apellidos = strOpt(row.obrero_apellidos);
  const nombre =
    nombres && apellidos ? `${nombres} ${apellidos}` : strOpt(row.obrero_nombre) || '';
  const cedula = strOpt(row.obrero_cedula) || '';
  const estadoCivil = estadoCivilContratoObrero(row.estado_civil);
  const direccion = strOpt(row.obrero_direccion) || 'de este domicilio';
  const nacionalidad = strOpt(row.nacionalidad);
  const fecha = strOpt(row.fecha_ingreso);

  return {
    obreroNombre: nombre,
    obreroCedula: cedula,
    obreroDireccion: direccion,
    horarioSemanalTexto: strOpt(row.horario_semanal_texto),
    estadoCivil,
    nacionalidad,
    fechaIngreso: fecha,
    fechaFirmaContratoIso: fecha,
    objetoContrato: strOpt(row.objeto_contrato),
    jornadaTrabajo: strOpt(row.jornada_trabajo),
    obreroMunicipioResidencia: strOpt(row.obrero_municipio_residencia),
    obreroEstadoResidencia: strOpt(row.obrero_estado_residencia),
    bonoManualUsd:
      row.bono_manual_usd != null && Number.isFinite(Number(row.bono_manual_usd))
        ? Number(row.bono_manual_usd)
        : row.bono_manual_ves != null && Number.isFinite(Number(row.bono_manual_ves))
          ? Number(row.bono_manual_ves)
          : null,
  };
}

/** Como {@link manualDesdeExpressRow}, pero prioriza estado civil de hoja de vida si existe. */
export async function manualDesdeExpressRowConHojaVida(
  client: SupabaseClient,
  row: ExpressRowPdf,
): Promise<ContratoExpressManualInput> {
  const base = manualDesdeExpressRow(row);
  const ced = (base.obreroCedula ?? '').trim();
  if (!ced) return base;
  const exp = await buscarEstadoCivilExpedientePorCedula(client, ced);
  return {
    ...base,
    estadoCivil: resolverEstadoCivilContrato({
      desdeHoja: exp.desdeHoja,
      desdeColumna: exp.desdeColumna,
      manual: base.estadoCivil,
    }),
  };
}

async function fetchExpressRow(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true; row: ExpressRowPdf } | { ok: false; error: string }> {
  const full = await supabase.from('ci_contratos_express').select(SELECT_FULL).eq('id', id).maybeSingle();
  if (full.error && /column|42703|schema cache|Could not find/i.test(full.error.message)) {
    const base = await supabase.from('ci_contratos_express').select(SELECT_BASE).eq('id', id).maybeSingle();
    if (base.error) return { ok: false, error: base.error.message };
    if (!base.data) return { ok: false, error: 'Contrato express no encontrado.' };
    return { ok: true, row: base.data as ExpressRowPdf };
  }
  if (full.error) return { ok: false, error: full.error.message };
  if (!full.data) return { ok: false, error: 'Contrato express no encontrado.' };
  return { ok: true, row: full.data as ExpressRowPdf };
}

export async function generarBufferContratoExpressPdf(
  supabase: SupabaseClient,
  expressId: string,
): Promise<{ ok: true; buf: Buffer; filename: string } | { ok: false; error: string }> {
  const id = expressId.trim();
  if (!id) return { ok: false, error: 'Falta id de contrato express.' };

  const fetched = await fetchExpressRow(supabase, id);
  if (!fetched.ok) return fetched;

  const row = fetched.row;
  const proyectoId = String(row.proyecto_id ?? '').trim();
  const configNominaId = String(row.config_nomina_id ?? '').trim();
  if (!proyectoId || !configNominaId) {
    return {
      ok: false,
      error:
        'Este contrato express no tiene proyecto o cargo (tabulador) vinculado; no se puede regenerar el PDF automáticamente.',
    };
  }

  const manual = await manualDesdeExpressRowConHojaVida(supabase, row);
  if (!manual.obreroNombre || !manual.obreroCedula) {
    return { ok: false, error: 'Faltan nombre o cédula del obrero en el contrato express.' };
  }
  if (!manual.objetoContrato) {
    manual.objetoContrato = await faseTecnicaDefaultProyecto(supabase, proyectoId);
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
 * Regenera el PDF estructurado del contrato express y lo sobrescribe en Storage.
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

  const fetched = await fetchExpressRow(admin, id);
  if (!fetched.ok) {
    const status = /no encontrado/i.test(fetched.error) ? 404 : 500;
    return { ok: false, error: fetched.error, status };
  }

  const built = await generarBufferContratoExpressPdf(admin, id);
  if (!built.ok) return { ok: false, error: built.error, status: 400 };

  const prevPath = String(fetched.row.pdf_storage_path ?? '').trim();
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
