import { randomUUID } from 'crypto';
import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';
import { cargarPropsContratoObreroPdfEstructurado } from '@/lib/talento/contratoObreroPdfContext';
import { construirExpedienteRefPorEmpleado } from '@/lib/talento/contratoExpedienteRef';
import { BUCKET_CONTRATOS_OBREROS, persistLaboralPlantillaPdfIfMissing } from '@/lib/talento/contratoLaboralRegistroStorage';
import {
  BUCKET_CONTRATOS,
  signedUrlContratos,
  storagePathContratoBorrador,
  storagePathContratoFirmado,
  subirPdfContratos,
} from '@/lib/contratos/contratosStorage';
import { ESTADO_CONTRATO, normalizarEstadoContrato } from '@/lib/contratos/rrhhContratoEstados';

const TOKEN_TTL_DIAS = 30;

export type MetadatosAceptacion = {
  ip?: string | null;
  user_agent?: string | null;
  geolocalizacion?: { lat: number; lng: number; precision?: number } | null;
  aceptado_en?: string;
  /** RRHH registra aceptación verbal / desatasco en pruebas */
  bypass_by_admin?: boolean;
  admin_id?: string;
  motivo?: string;
};

const ESTADOS_PENDIENTES_ACEPTACION = [
  ESTADO_CONTRATO.GENERADO_PENDIENTE,
  ESTADO_CONTRATO.GENERADO,
] as const;

export function buildUrlAceptacionContrato(baseUrl: string, contratoId: string, tokenAceptacion: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/registro/contrato-laboral/${encodeURIComponent(contratoId)}?token=${encodeURIComponent(tokenAceptacion)}`;
}

export function buildMensajeWhatsappContrato(params: {
  nombreObrero: string;
  urlAceptacion: string;
  proyectoNombre?: string | null;
}): string {
  const nom = params.nombreObrero.trim() || 'trabajador(a)';
  const proy = (params.proyectoNombre ?? '').trim();
  const intro = proy
    ? `Hola ${nom}, desde RRHH de Casa Inteligente te enviamos tu contrato individual para el proyecto *${proy}*.`
    : `Hola ${nom}, desde RRHH de Casa Inteligente te enviamos tu contrato individual de trabajo.`;
  return `${intro}

Revisa el documento y acéptalo digitalmente desde tu celular:
${params.urlAceptacion}

El enlace es personal y temporal. Si tienes dudas, contacta a RRHH.`;
}

async function generarPdfEstructuradoEmpleado(
  admin: SupabaseClient,
  empleadoId: string,
): Promise<{ buf: Buffer } | { error: string }> {
  const st = await cargarPropsContratoObreroPdfEstructurado(admin, empleadoId);
  if (!st.ok) return { error: st.error };
  const expedienteRef = await construirExpedienteRefPorEmpleado(admin, empleadoId);
  const node = createElement(ContratoObreroPDF, { ...st.props, expedienteId: expedienteRef });
  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
  return { buf: Buffer.from(await blob.arrayBuffer()) };
}

export type GenerarContratoRrhhInput = {
  empleadoId: string;
  proyectoId: string;
  publicBaseUrl: string;
  marcarWhatsappEnviado?: boolean;
};

export type GenerarContratoRrhhOk = {
  contratoId: string;
  tokenAceptacion: string;
  urlAceptacion: string;
  mensajeWhatsapp: string;
  storagePathBorrador: string;
  urlBorradorFirmada: string;
  estadoContrato: string;
};

export async function generarContratoRrhh(
  admin: SupabaseClient,
  input: GenerarContratoRrhhInput,
): Promise<GenerarContratoRrhhOk | { error: string; status?: number }> {
  const empleadoId = input.empleadoId.trim();
  const proyectoId = input.proyectoId.trim();
  if (!empleadoId || !proyectoId) {
    return { error: 'empleadoId y proyectoId son requeridos', status: 400 };
  }

  const { data: emp, error: eEmp } = await admin
    .from('ci_empleados')
    .select('id,nombre_completo,cedula,documento,proyecto_modulo_id')
    .eq('id', empleadoId)
    .maybeSingle();
  if (eEmp || !emp) {
    return { error: eEmp?.message ?? 'Empleado no encontrado', status: 404 };
  }
  const row = emp as {
    id: string;
    nombre_completo?: string | null;
    cedula?: string | null;
    documento?: string | null;
  };
  const cedula = (row.cedula ?? row.documento ?? 'sin_cedula').trim();

  const pdfOut = await generarPdfEstructuradoEmpleado(admin, empleadoId);
  if ('error' in pdfOut) return { error: pdfOut.error, status: 500 };

  const pathBorrador = storagePathContratoBorrador(proyectoId, cedula);
  const up = await subirPdfContratos(admin, pathBorrador, pdfOut.buf, true);
  if ('error' in up) return { error: up.error, status: 500 };

  const tokenAceptacion = randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const ahora = new Date().toISOString();

  const { data: exist } = await admin
    .from('ci_contratos_empleado_obra')
    .select('id')
    .eq('empleado_id', empleadoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const patch = {
    empleado_id: empleadoId,
    obra_id: proyectoId,
    proyecto_id: proyectoId,
    estado_contrato: ESTADO_CONTRATO.GENERADO_PENDIENTE,
    token_aceptacion: tokenAceptacion,
    token_aceptacion_expires_at: expiresAt,
    storage_path_borrador: pathBorrador,
    laboral_pdf_storage_path: pathBorrador,
    url_contrato_borrador: pathBorrador,
    laboral_pdf_generado_at: ahora,
    whatsapp_enviado_at: input.marcarWhatsappEnviado ? ahora : null,
  };

  let contratoId: string;
  if (exist) {
    contratoId = (exist as { id: string }).id;
    const { error: upErr } = await admin
      .from('ci_contratos_empleado_obra')
      .update(patch as never)
      .eq('id', contratoId);
    if (upErr) return { error: upErr.message, status: 500 };
  } else {
    const { data: ins, error: insErr } = await admin
      .from('ci_contratos_empleado_obra')
      .insert(patch as never)
      .select('id')
      .single();
    if (insErr || !ins) return { error: insErr?.message ?? 'No se creó el contrato', status: 500 };
    contratoId = (ins as { id: string }).id;
  }

  await persistLaboralPlantillaPdfIfMissing(admin, contratoId, pdfOut.buf);
  await admin.storage.from(BUCKET_CONTRATOS_OBREROS).upload(`laboral/${contratoId}/contrato-plantilla.pdf`, pdfOut.buf, {
    contentType: 'application/pdf',
    upsert: true,
  });

  const signed = await signedUrlContratos(admin, pathBorrador, 3600);
  const urlBorradorFirmada = 'error' in signed ? '' : signed.url;
  const urlAceptacion = buildUrlAceptacionContrato(input.publicBaseUrl, contratoId, tokenAceptacion);

  const { data: proy } = await admin.from('ci_proyectos').select('nombre').eq('id', proyectoId).maybeSingle();
  const mensajeWhatsapp = buildMensajeWhatsappContrato({
    nombreObrero: (row.nombre_completo ?? '').trim(),
    urlAceptacion,
    proyectoNombre: (proy as { nombre?: string | null } | null)?.nombre,
  });

  return {
    contratoId,
    tokenAceptacion,
    urlAceptacion,
    mensajeWhatsapp,
    storagePathBorrador: pathBorrador,
    urlBorradorFirmada,
    estadoContrato: ESTADO_CONTRATO.GENERADO_PENDIENTE,
  };
}

export async function aceptarContratoPorToken(
  admin: SupabaseClient,
  params: {
    contratoId: string;
    token: string;
    metadatos: MetadatosAceptacion;
  },
): Promise<{ ok: true; aceptadoEn: string } | { error: string; status: number }> {
  const contratoId = params.contratoId.trim();
  const token = params.token.trim();
  if (!contratoId || !token) {
    return { error: 'contratoId y token requeridos', status: 400 };
  }

  const { data: row, error: sel } = await admin
    .from('ci_contratos_empleado_obra')
    .select(
      'id,empleado_id,estado_contrato,token_aceptacion,token_aceptacion_expires_at,aceptado_digital_at,obrero_aceptacion_contrato_at',
    )
    .eq('id', contratoId)
    .maybeSingle();

  if (sel) return { error: sel.message, status: 500 };
  if (!row) return { error: 'Contrato no encontrado', status: 404 };

  const c = row as {
    id: string;
    empleado_id: string;
    estado_contrato?: string | null;
    token_aceptacion?: string | null;
    token_aceptacion_expires_at?: string | null;
    aceptado_digital_at?: string | null;
    obrero_aceptacion_contrato_at?: string | null;
  };

  const tokRow = (c.token_aceptacion ?? '').trim();
  let tokenValido = tokRow === token;
  if (!tokenValido) {
    const { data: emp } = await admin
      .from('ci_empleados')
      .select('token_registro,token')
      .eq('id', c.empleado_id)
      .maybeSingle();
    const e = emp as { token_registro?: string | null; token?: string | null } | null;
    tokenValido =
      token === (e?.token_registro ?? '').trim() || token === (e?.token ?? '').trim();
  }
  if (!tokenValido) return { error: 'Token inválido', status: 403 };

  if (c.token_aceptacion_expires_at) {
    if (new Date() > new Date(c.token_aceptacion_expires_at)) {
      return { error: 'El enlace ha expirado', status: 410 };
    }
  }

  if (c.aceptado_digital_at || c.obrero_aceptacion_contrato_at) {
    return {
      ok: true,
      aceptadoEn: c.aceptado_digital_at ?? c.obrero_aceptacion_contrato_at ?? new Date().toISOString(),
    };
  }

  const ahora = new Date().toISOString();
  const meta: MetadatosAceptacion = { ...params.metadatos, aceptado_en: ahora };

  const { error: up } = await admin
    .from('ci_contratos_empleado_obra')
    .update({
      estado_contrato: ESTADO_CONTRATO.ACEPTADO_DIGITAL,
      aceptado_digital_at: ahora,
      obrero_aceptacion_contrato_at: ahora,
      metadatos_aceptacion: meta,
      obrero_aceptacion_cliente: meta,
      notificacion_rrhh_at: ahora,
    } as never)
    .eq('id', contratoId);

  if (up) return { error: up.message, status: 500 };

  return { ok: true, aceptadoEn: ahora };
}

/**
 * Aceptación digital registrada por RRHH/Admin (verbal en oficina, pruebas, desatasco).
 * Body típico: `{ bypass_by_admin: true, admin_id, motivo }`.
 */
export async function aceptarContratoPorAdminBypass(
  admin: SupabaseClient,
  params: {
    contratoId?: string;
    empleadoId?: string;
    adminId: string;
    motivo: string;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<
  | { ok: true; aceptadoEn: string; contratoId: string; yaAceptado: boolean }
  | { error: string; status: number }
> {
  const adminId = params.adminId.trim();
  const motivo = params.motivo.trim();
  if (!adminId) return { error: 'admin_id requerido', status: 400 };
  if (!motivo) return { error: 'Indique el motivo del bypass', status: 400 };

  const contratoIdIn = (params.contratoId ?? '').trim();
  const empleadoIdIn = (params.empleadoId ?? '').trim();

  let contratoId = contratoIdIn;
  if (!contratoId && empleadoIdIn) {
    const { data: rows, error: selEmp } = await admin
      .from('ci_contratos_empleado_obra')
      .select('id,estado_contrato,aceptado_digital_at,obrero_aceptacion_contrato_at')
      .eq('empleado_id', empleadoIdIn)
      .order('created_at', { ascending: false })
      .limit(1);
    if (selEmp) return { error: selEmp.message, status: 500 };
    const row = (rows as { id: string }[] | null)?.[0];
    if (!row) return { error: 'No hay contrato para este empleado', status: 404 };
    contratoId = row.id;
  }

  if (!contratoId) {
    return { error: 'contratoId o empleadoId requerido', status: 400 };
  }

  const { data: row, error: sel } = await admin
    .from('ci_contratos_empleado_obra')
    .select(
      'id,estado_contrato,aceptado_digital_at,obrero_aceptacion_contrato_at',
    )
    .eq('id', contratoId)
    .maybeSingle();

  if (sel) return { error: sel.message, status: 500 };
  if (!row) return { error: 'Contrato no encontrado', status: 404 };

  const c = row as {
    id: string;
    estado_contrato?: string | null;
    aceptado_digital_at?: string | null;
    obrero_aceptacion_contrato_at?: string | null;
  };

  if (c.aceptado_digital_at || c.obrero_aceptacion_contrato_at) {
    return {
      ok: true,
      aceptadoEn: c.aceptado_digital_at ?? c.obrero_aceptacion_contrato_at ?? new Date().toISOString(),
      contratoId: c.id,
      yaAceptado: true,
    };
  }

  const estado = normalizarEstadoContrato(c.estado_contrato);
  if (!ESTADOS_PENDIENTES_ACEPTACION.includes(estado as (typeof ESTADOS_PENDIENTES_ACEPTACION)[number])) {
    return {
      error: `El contrato no está pendiente de aceptación (estado: ${c.estado_contrato ?? '—'})`,
      status: 409,
    };
  }

  const ahora = new Date().toISOString();
  const meta: MetadatosAceptacion = {
    bypass_by_admin: true,
    admin_id: adminId,
    motivo,
    ip: params.ip ?? null,
    user_agent: params.userAgent ?? null,
    aceptado_en: ahora,
  };

  const { error: up } = await admin
    .from('ci_contratos_empleado_obra')
    .update({
      estado_contrato: ESTADO_CONTRATO.ACEPTADO_DIGITAL,
      aceptado_digital_at: ahora,
      obrero_aceptacion_contrato_at: ahora,
      metadatos_aceptacion: meta,
      obrero_aceptacion_cliente: meta,
      notificacion_rrhh_at: ahora,
    } as never)
    .eq('id', contratoId);

  if (up) return { error: up.message, status: 500 };

  return { ok: true, aceptadoEn: ahora, contratoId, yaAceptado: false };
}

export type ArchivarContratoRrhhInput = {
  contratoId: string;
  archivo: Buffer;
  mime: string;
  ubicacionArchivoReal: string;
  copiaDigitalIndexada: boolean;
  archivadoPorUsuarioId: string;
  proyectoId: string;
  cedula: string;
};

export async function archivarContratoRrhh(
  admin: SupabaseClient,
  input: ArchivarContratoRrhhInput,
): Promise<{ ok: true; empleadoId: string } | { error: string; status: number }> {
  const contratoId = input.contratoId.trim();
  if (!contratoId) return { error: 'contratoId requerido', status: 400 };
  if (!input.ubicacionArchivoReal.trim()) {
    return { error: 'Indique la ubicación del archivo físico', status: 400 };
  }
  if (!input.copiaDigitalIndexada) {
    return { error: 'Debe confirmar que la copia digital está indexada', status: 400 };
  }

  const { data: row, error: sel } = await admin
    .from('ci_contratos_empleado_obra')
    .select('id,empleado_id,estado_contrato,obra_id,proyecto_id')
    .eq('id', contratoId)
    .maybeSingle();
  if (sel) return { error: sel.message, status: 500 };
  if (!row) return { error: 'Contrato no encontrado', status: 404 };

  const c = row as {
    id: string;
    empleado_id: string;
    estado_contrato?: string | null;
    obra_id?: string | null;
    proyecto_id?: string | null;
  };

  const estado = normalizarEstadoContrato(c.estado_contrato);
  if (estado !== ESTADO_CONTRATO.ACEPTADO_DIGITAL && estado !== ESTADO_CONTRATO.FIRMADO_Y_ARCHIVADO) {
    return {
      error: 'El obrero debe aceptar el contrato digitalmente antes de archivar el escaneo firmado',
      status: 409,
    };
  }

  const proyectoId = (input.proyectoId || c.proyecto_id || c.obra_id || '').trim();
  const pathFirmado = storagePathContratoFirmado(proyectoId, input.cedula);
  const { error: upSt } = await admin.storage.from(BUCKET_CONTRATOS).upload(pathFirmado, input.archivo, {
    contentType: input.mime || 'application/pdf',
    upsert: true,
  });
  if (upSt) return { error: upSt.message, status: 500 };

  const ahora = new Date().toISOString();
  const { error: upCtr } = await admin
    .from('ci_contratos_empleado_obra')
    .update({
      estado_contrato: ESTADO_CONTRATO.FIRMADO_Y_ARCHIVADO,
      storage_path_firmado: pathFirmado,
      url_contrato_firmado: pathFirmado,
      laboral_escaneo_firmado_storage_path: pathFirmado,
      laboral_escaneo_firmado_at: ahora,
      firmado_fisico_at: ahora,
      ubicacion_archivo_real: input.ubicacionArchivoReal.trim(),
      copia_digital_indexada: true,
      archivado_at: ahora,
      archivado_por_usuario_id: input.archivadoPorUsuarioId,
    } as never)
    .eq('id', contratoId);
  if (upCtr) return { error: upCtr.message, status: 500 };

  const pid = proyectoId;
  if (pid) {
    await admin.from('ci_obra_empleados').upsert(
      {
        obra_id: pid,
        empleado_id: c.empleado_id,
        honorarios_acordados_usd: 0,
        multas_acumuladas_usd: 0,
      } as never,
      { onConflict: 'obra_id,empleado_id' },
    );
  }

  await admin
    .from('ci_empleados')
    .update({
      estado: 'aprobado',
      estatus: 'asignado',
      estado_proceso: 'contratado_activo',
      proyecto_modulo_id: pid || undefined,
    } as never)
    .eq('id', c.empleado_id);

  return { ok: true, empleadoId: c.empleado_id };
}
