import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarPropsContratoObreroPdfExpress,
  type ContratoExpressManualInput,
} from '@/lib/talento/contratoObreroPdfContext';
import {
  BUCKET_CONTRATOS_OBREROS,
  signedUrlContratoLaboralBucket,
} from '@/lib/talento/contratoLaboralRegistroStorage';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';
import {
  buscarEstadoCivilExpedientePorCedula,
  resolverEstadoCivilContrato,
} from '@/lib/talento/estadoCivilDesdeHojaVida';
import {
  faseTecnicaDefaultProyecto,
  recordarFaseTecnicaUsada,
  trimFaseTecnica,
} from '@/lib/talento/fasesTecnicasContrato';
import { construirExpedienteContratoExpress } from '@/lib/talento/nomenclaturaExpedienteContrato';
import {
  nombreArchivoPdfContratoIndividual,
  storagePathPdfContratoExpress,
} from '@/lib/talento/nombreArchivoContratoIndividual';
import { normalizarFechaIngresoIso } from '@/lib/talento/parseCsvContratosExpress';

export type CrearContratoExpressInput = {
  proyecto_id: string;
  config_nomina_id: string;
  obrero_nombre?: string | null;
  obrero_nombres?: string | null;
  obrero_apellidos?: string | null;
  obrero_cedula: string;
  obrero_direccion?: string | null;
  bono_manual_usd?: number;
  entidad_patrono_id?: string | null;
  fecha_ingreso?: string | null;
  objeto_contrato?: string | null;
  jornada_trabajo?: string | null;
  tipo_contrato?: string | null;
  nacionalidad?: string | null;
  estado_civil?: string | null;
  horario_semanal_texto?: string | null;
  obrero_municipio_residencia?: string | null;
  obrero_estado_residencia?: string | null;
  /**
   * Oficio del listado/Excel (opcional). Solo para emparejar; en el PDF se usa
   * la denominación del tabulador/Gaceta (`ci_config_nomina.cargo_nombre`).
   */
  cargo_nombre_listado?: string | null;
  created_by?: string | null;
  /** Si false, no genera signed URL (más rápido en lote). Default true. */
  incluir_signed_url?: boolean;
  /** Si false, no escribe en catálogo de fases (p. ej. lote: se graba una sola vez al final). Default true. */
  recordar_fase_tecnica?: boolean;
};

export type CrearContratoExpressOk = {
  ok: true;
  id: string;
  expediente_label: string;
  pdf_storage_path: string;
  signed_url: string | null;
  signed_url_error: string | null;
};

export type CrearContratoExpressFail = {
  ok: false;
  error: string;
};

function nombreCompletoObrero(input: CrearContratoExpressInput): string {
  const nom = (input.obrero_nombres ?? '').trim();
  const ape = (input.obrero_apellidos ?? '').trim();
  if (nom && ape) return `${nom} ${ape}`.trim();
  return (input.obrero_nombre ?? '').trim();
}

function validarInput(input: CrearContratoExpressInput): string | null {
  if (!input.proyecto_id?.trim()) return 'Falta proyecto_id.';
  if (!input.config_nomina_id?.trim()) return 'Falta config_nomina_id (oficio / tabulador).';
  const ced = normCedulaToken(String(input.obrero_cedula ?? ''));
  if (!CEDULA_VE_NORMALIZADA_REGEX.test(ced)) {
    return 'Formato de cédula inválido (Ej: V-12345678).';
  }
  const full = nombreCompletoObrero(input);
  if (full.length < 2) {
    return 'Indique nombres y apellidos del trabajador (o un nombre completo).';
  }
  return null;
}

function manualDesdeInput(
  input: CrearContratoExpressInput,
  fechaFirmaIso: string,
  estadoCivilResuelto: string,
): ContratoExpressManualInput {
  return {
    obreroNombre: nombreCompletoObrero(input),
    obreroCedula: normCedulaToken(String(input.obrero_cedula)),
    obreroDireccion: input.obrero_direccion?.trim() || null,
    nacionalidad: input.nacionalidad?.trim() || null,
    estadoCivil: estadoCivilResuelto,
    fechaIngreso: input.fecha_ingreso?.trim() || fechaFirmaIso,
    fechaFirmaContratoIso: fechaFirmaIso,
    objetoContrato: input.objeto_contrato?.trim() || null,
    jornadaTrabajo: input.jornada_trabajo?.trim() || null,
    tipoContrato: input.tipo_contrato?.trim() || null,
    horarioSemanalTexto: input.horario_semanal_texto?.trim() || null,
    obreroMunicipioResidencia: input.obrero_municipio_residencia?.trim() || null,
    obreroEstadoResidencia: input.obrero_estado_residencia?.trim() || null,
    bonoManualUsd: Number(input.bono_manual_usd ?? 0) || 0,
    cargoNombreListado: input.cargo_nombre_listado?.trim() || null,
  };
}

/**
 * Genera PDF + storage + fila en `ci_contratos_express` (mismo flujo que POST /api/talento/contratos-fast).
 */
export async function crearContratoExpress(
  admin: SupabaseClient,
  input: CrearContratoExpressInput,
): Promise<CrearContratoExpressOk | CrearContratoExpressFail> {
  const validacion = validarInput(input);
  if (validacion) return { ok: false, error: validacion };

  const fechaNorm = normalizarFechaIngresoIso(input.fecha_ingreso ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNorm)) {
    return {
      ok: false,
      error: input.fecha_ingreso?.trim()
        ? `Fecha de ingreso inválida «${input.fecha_ingreso}». Use YYYY-MM-DD o día/mes/año (ej. 3/8/2026).`
        : 'Falta fecha de ingreso (requerida para la fecha de cierre del contrato).',
    };
  }
  const fechaFirmaIso = fechaNorm;

  const cedula = normCedulaToken(String(input.obrero_cedula));
  let objetoContrato = trimFaseTecnica(input.objeto_contrato);
  if (!objetoContrato) {
    objetoContrato = await faseTecnicaDefaultProyecto(admin, input.proyecto_id);
  }
  const expedienteEc = await buscarEstadoCivilExpedientePorCedula(admin, cedula);
  const estadoCivilResuelto = resolverEstadoCivilContrato({
    desdeHoja: expedienteEc.desdeHoja,
    desdeColumna: expedienteEc.desdeColumna,
    manual: input.estado_civil,
  });
  const inputConFase: CrearContratoExpressInput = {
    ...input,
    obrero_cedula: cedula,
    objeto_contrato: objetoContrato,
    estado_civil: estadoCivilResuelto,
  };
  const manual = manualDesdeInput(inputConFase, fechaFirmaIso, estadoCivilResuelto);

  const loaded = await cargarPropsContratoObreroPdfExpress(
    admin,
    input.proyecto_id,
    input.config_nomina_id,
    manual,
    { entidadPatronoId: input.entidad_patrono_id?.trim() || null },
  );
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const expressId = crypto.randomUUID();
  const expedienteLabel = await construirExpedienteContratoExpress(admin, {
    proyectoId: input.proyecto_id,
    entidadId: input.entidad_patrono_id,
    fechaIso: fechaFirmaIso,
    expressId,
  });

  let buf: Buffer;
  try {
    const node = createElement(ContratoObreroPDF, {
      ...loaded.props,
      expedienteId: expedienteLabel,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    buf = Buffer.from(await blob.arrayBuffer());
  } catch (e) {
    console.error('[crearContratoExpress] pdf', e);
    return { ok: false, error: 'No se pudo generar el PDF' };
  }

  const pdfFilename = nombreArchivoPdfContratoIndividual(expedienteLabel, {
    nombres: input.obrero_nombres,
    apellidos: input.obrero_apellidos,
    nombreCompleto: nombreCompletoObrero(input),
  });
  const storagePath = storagePathPdfContratoExpress(expressId, pdfFilename);
  const { error: upErr } = await admin.storage.from(BUCKET_CONTRATOS_OBREROS).upload(storagePath, buf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (upErr) {
    console.error('[crearContratoExpress] storage', upErr.message);
    return { ok: false, error: upErr.message };
  }

  const { data: nomSnap } = await admin
    .from('ci_config_nomina')
    .select('cargo_nombre,salario_base_mensual')
    .eq('id', input.config_nomina_id)
    .maybeSingle();
  const snap = nomSnap as { cargo_nombre?: string | null; salario_base_mensual?: unknown } | null;
  const salSnap = snap?.salario_base_mensual != null ? Number(snap.salario_base_mensual) : null;
  // Denominación oficial Gaceta / tabulador (p. ej. «Ayudante», «Carpintero de 1ra.»).
  const cargoSnapshot = snap?.cargo_nombre?.trim() || null;

  const horarioVal =
    (input.horario_semanal_texto?.trim() || loaded.props.parametros.horarioSemanal?.trim() || null) as
      | string
      | null;

  const payloadFull = {
    id: expressId,
    proyecto_id: input.proyecto_id,
    config_nomina_id: input.config_nomina_id,
    obrero_nombre: nombreCompletoObrero(input),
    obrero_nombres: input.obrero_nombres?.trim() || null,
    obrero_apellidos: input.obrero_apellidos?.trim() || null,
    obrero_cedula: cedula,
    obrero_direccion: input.obrero_direccion?.trim() || 'de este domicilio',
    salario_base_mensual_snapshot: salSnap != null && Number.isFinite(salSnap) ? salSnap : null,
    cargo_nombre_snapshot: cargoSnapshot,
    pdf_storage_path: storagePath,
    expediente_label: expedienteLabel,
    created_by: input.created_by ?? null,
    bono_manual_usd: Number(input.bono_manual_usd ?? 0) || 0,
    horario_semanal_texto: horarioVal,
    estado_civil: estadoCivilResuelto,
    nacionalidad: input.nacionalidad?.trim() || null,
    fecha_ingreso: fechaFirmaIso,
    objeto_contrato: objetoContrato,
    jornada_trabajo: input.jornada_trabajo?.trim() || null,
    obrero_municipio_residencia: input.obrero_municipio_residencia?.trim() || null,
    obrero_estado_residencia: input.obrero_estado_residencia?.trim() || null,
  };

  let { data, error: insErr } = await admin
    .from('ci_contratos_express')
    .insert(payloadFull as never)
    .select('id')
    .maybeSingle();

  if (insErr && /column|42703|schema cache|Could not find/i.test(insErr.message)) {
    const payloadLite = {
      id: expressId,
      proyecto_id: input.proyecto_id,
      config_nomina_id: input.config_nomina_id,
      obrero_nombre: nombreCompletoObrero(input),
      obrero_cedula: cedula,
      obrero_direccion: input.obrero_direccion?.trim() || null,
      salario_base_mensual_snapshot: salSnap != null && Number.isFinite(salSnap) ? salSnap : null,
      cargo_nombre_snapshot: cargoSnapshot,
      pdf_storage_path: storagePath,
      created_by: input.created_by ?? null,
      bono_manual_usd: Number(input.bono_manual_usd ?? 0) || 0,
      horario_semanal_texto: horarioVal,
    };
    const retry = await admin
      .from('ci_contratos_express')
      .insert(payloadLite as never)
      .select('id')
      .maybeSingle();
    data = retry.data;
    insErr = retry.error;
  }

  if (insErr) {
    console.error('[crearContratoExpress] insert', insErr.message);
    return { ok: false, error: insErr.message };
  }

  if (!data || (data as { id?: string }).id !== expressId) {
    return {
      ok: false,
      error: 'El INSERT no devolvió el id del contrato express o no se pudo confirmar.',
    };
  }

  if (objetoContrato && input.recordar_fase_tecnica !== false) {
    await recordarFaseTecnicaUsada(admin, objetoContrato, { proyectoId: input.proyecto_id });
  }

  let signed_url: string | null = null;
  let signed_url_error: string | null = null;
  if (input.incluir_signed_url !== false) {
    const signed = await signedUrlContratoLaboralBucket(admin, storagePath, 3600);
    signed_url = 'url' in signed ? signed.url : null;
    signed_url_error = 'error' in signed ? signed.error : null;
  }

  return {
    ok: true,
    id: expressId,
    expediente_label: expedienteLabel,
    pdf_storage_path: storagePath,
    signed_url,
    signed_url_error,
  };
}
