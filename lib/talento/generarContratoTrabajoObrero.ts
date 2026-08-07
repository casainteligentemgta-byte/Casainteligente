/**
 * Genera un contrato de trabajo (obrero) — PDF + fila en `ci_contratos_express`
 * (antes «contrato express» / contratos-fast).
 */

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
import { CEDULA_VE_NORMALIZADA_REGEX, estadoCivilContratoObrero, nacionalidadDesdeCedula, normCedulaToken, trabajadorFemeninoDesdeEstadoCivil } from '@/lib/talento/cedulaAuth';
import { resolverCodigoExpedienteContrato } from '@/lib/talento/codigoExpedienteContrato';
import { esContratoExpressAdministracionDelegada } from '@/lib/talento/filtrarContratosExpressObrero';

export type GenerarContratoTrabajoObreroInput = {
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
};

export type GenerarContratoTrabajoObreroOk = {
  ok: true;
  id: string;
  expediente_label: string;
  pdf_storage_path: string;
  signed_url: string | null;
  signed_url_error: string | null;
};

export type GenerarContratoTrabajoObreroErr = {
  ok: false;
  error: string;
  status: number;
};

function nombreCompleto(input: GenerarContratoTrabajoObreroInput): string {
  const nom = (input.obrero_nombres ?? '').trim();
  const ape = (input.obrero_apellidos ?? '').trim();
  if (nom && ape) return `${nom} ${ape}`.trim();
  return (input.obrero_nombre ?? '').trim();
}

function hoyIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function validarInput(input: GenerarContratoTrabajoObreroInput): string | null {
  if (!input.proyecto_id?.trim()) return 'Falta proyecto_id';
  if (!input.config_nomina_id?.trim()) return 'Falta config_nomina_id (cargo / tabulador)';
  const ced = normCedulaToken(input.obrero_cedula ?? '');
  if (!CEDULA_VE_NORMALIZADA_REGEX.test(ced)) {
    return 'Formato de cédula inválido (Ej: V-12345678)';
  }
  if (nombreCompleto(input).length < 2) {
    return 'Indique nombres y apellidos del trabajador (o un nombre completo).';
  }
  return null;
}

/**
 * Genera PDF estructurado, sube a Storage y registra en `ci_contratos_express`.
 */
export async function generarContratoTrabajoObrero(
  admin: SupabaseClient,
  input: GenerarContratoTrabajoObreroInput,
  opts?: { createdBy?: string | null },
): Promise<GenerarContratoTrabajoObreroOk | GenerarContratoTrabajoObreroErr> {
  const errVal = validarInput(input);
  if (errVal) return { ok: false, error: errVal, status: 400 };

  const cedula = normCedulaToken(input.obrero_cedula);
  const fechaFirmaIso = input.fecha_ingreso?.trim() || hoyIsoLocal();
  const obreroNombreCompleto = nombreCompleto(input);

  // Anti-duplicado: misma cédula en el mismo proyecto (salvo filas AD).
  {
    const dupFull = await admin
      .from('ci_contratos_express')
      .select('id,obrero_cedula,obrero_nombre,tipo_contrato')
      .eq('proyecto_id', input.proyecto_id.trim())
      .limit(500);
    let dupRows = (!dupFull.error ? dupFull.data : null) as
      | { id?: string; obrero_cedula?: string | null; obrero_nombre?: string | null; tipo_contrato?: string | null }[]
      | null;
    if (dupFull.error && /tipo_contrato|42703|schema cache|column/i.test(dupFull.error.message ?? '')) {
      const dupLite = await admin
        .from('ci_contratos_express')
        .select('id,obrero_cedula,obrero_nombre')
        .eq('proyecto_id', input.proyecto_id.trim())
        .limit(500);
      dupRows = (!dupLite.error ? dupLite.data : null) as typeof dupRows;
    }
    const yaExiste = (dupRows ?? []).some((r) => {
      if (esContratoExpressAdministracionDelegada(r)) return false;
      return normCedulaToken(r.obrero_cedula ?? '') === cedula;
    });
    if (yaExiste) {
      return {
        ok: false,
        error: `Ya existe un contrato de trabajo (express) con la cédula ${cedula} en este proyecto.`,
        status: 409,
      };
    }
  }

  const nacionalidad =
    nacionalidadDesdeCedula(cedula, trabajadorFemeninoDesdeEstadoCivil(input.estado_civil)) ??
    (input.nacionalidad?.trim() ||
      (trabajadorFemeninoDesdeEstadoCivil(input.estado_civil) ? 'venezolana' : 'venezolano'));
  const estadoCivil = estadoCivilContratoObrero(input.estado_civil);

  const manual: ContratoExpressManualInput = {
    obreroNombre: obreroNombreCompleto,
    obreroCedula: cedula,
    obreroDireccion: input.obrero_direccion?.trim() || null,
    nacionalidad,
    estadoCivil,
    fechaIngreso: fechaFirmaIso,
    fechaFirmaContratoIso: fechaFirmaIso,
    objetoContrato: input.objeto_contrato?.trim() || null,
    jornadaTrabajo: input.jornada_trabajo?.trim() || null,
    tipoContrato: input.tipo_contrato?.trim() || null,
    horarioSemanalTexto: input.horario_semanal_texto?.trim() || null,
    obreroMunicipioResidencia: input.obrero_municipio_residencia?.trim() || null,
    obreroEstadoResidencia: input.obrero_estado_residencia?.trim() || null,
    bonoManualUsd: input.bono_manual_usd ?? 0,
  };

  const loaded = await cargarPropsContratoObreroPdfExpress(
    admin,
    input.proyecto_id.trim(),
    input.config_nomina_id.trim(),
    manual,
    { entidadPatronoId: input.entidad_patrono_id?.trim() || null },
  );
  if (!loaded.ok) {
    return { ok: false, error: loaded.error, status: 400 };
  }

  const expressId = crypto.randomUUID();
  const expedienteLabel = await resolverCodigoExpedienteContrato(admin, {
    proyectoId: input.proyecto_id.trim(),
    entidadPatronoId: input.entidad_patrono_id?.trim() || null,
    fecha: fechaFirmaIso,
    expressId: null,
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
    console.error('[generarContratoTrabajoObrero] pdf', e);
    return { ok: false, error: 'No se pudo generar el PDF', status: 500 };
  }

  const storagePath = `express/${expressId}/contrato-estructurado.pdf`;
  const { error: upErr } = await admin.storage.from(BUCKET_CONTRATOS_OBREROS).upload(storagePath, buf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (upErr) {
    console.error('[generarContratoTrabajoObrero] storage', upErr.message);
    return { ok: false, error: upErr.message, status: 500 };
  }

  const { data: nomSnap } = await admin
    .from('ci_config_nomina')
    .select('cargo_nombre,salario_base_mensual')
    .eq('id', input.config_nomina_id.trim())
    .maybeSingle();
  const snap = nomSnap as { cargo_nombre?: string | null; salario_base_mensual?: unknown } | null;
  const salSnap = snap?.salario_base_mensual != null ? Number(snap.salario_base_mensual) : null;

  const horarioVal =
    (input.horario_semanal_texto?.trim() || loaded.props.parametros.horarioSemanal?.trim() || null) as
      | string
      | null;

  const payloadBase = {
    id: expressId,
    proyecto_id: input.proyecto_id.trim(),
    config_nomina_id: input.config_nomina_id.trim(),
    obrero_nombre: obreroNombreCompleto,
    obrero_cedula: cedula,
    obrero_direccion: input.obrero_direccion?.trim() || null,
    salario_base_mensual_snapshot: salSnap != null && Number.isFinite(salSnap) ? salSnap : null,
    cargo_nombre_snapshot: snap?.cargo_nombre?.trim() || null,
    pdf_storage_path: storagePath,
    created_by: opts?.createdBy ?? null,
    bono_manual_usd: input.bono_manual_usd ?? 0,
    horario_semanal_texto: horarioVal,
  };

  const intentos: Record<string, unknown>[] = [
    {
      ...payloadBase,
      expediente_codigo: expedienteLabel,
      obrero_nombres: input.obrero_nombres?.trim() || null,
      obrero_apellidos: input.obrero_apellidos?.trim() || null,
    },
    {
      ...payloadBase,
      expediente_codigo: expedienteLabel,
    },
    {
      ...payloadBase,
      obrero_nombres: input.obrero_nombres?.trim() || null,
      obrero_apellidos: input.obrero_apellidos?.trim() || null,
    },
    payloadBase,
  ];

  let data: { id?: string } | null = null;
  let insErr: { message?: string; code?: string } | null = null;

  for (const payload of intentos) {
    const res = await admin
      .from('ci_contratos_express')
      .insert(payload as never)
      .select('id')
      .maybeSingle();
    data = res.data as { id?: string } | null;
    insErr = res.error;
    if (!insErr) break;
    const msg = insErr.message ?? '';
    const columnaNueva =
      /obrero_(nombres|apellidos)|expediente_codigo/i.test(msg) &&
      /schema cache|could not find|42703/i.test(msg);
    if (!columnaNueva) break;
    console.warn(
      '[generarContratoTrabajoObrero] columna ausente al insertar; reintento con payload reducido. Aplique migraciones 309/311.',
      msg,
    );
  }

  if (insErr) {
    console.error('[generarContratoTrabajoObrero] insert', insErr.message);
    return { ok: false, error: insErr.message ?? 'Error al guardar el contrato', status: 500 };
  }

  if (!data || (data as { id?: string }).id !== expressId) {
    return {
      ok: false,
      error: 'El INSERT no devolvió el id del contrato de trabajo o no se pudo confirmar.',
      status: 500,
    };
  }

  const signed = await signedUrlContratoLaboralBucket(admin, storagePath, 3600);

  return {
    ok: true,
    id: expressId,
    expediente_label: expedienteLabel,
    pdf_storage_path: storagePath,
    signed_url: 'url' in signed ? signed.url : null,
    signed_url_error: 'error' in signed ? signed.error : null,
  };
}
