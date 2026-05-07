import { randomUUID } from 'crypto';
import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { antecedentesPenalesJson, buildHojaVidaFromGacetaForm } from '@/lib/registro/buildHojaVidaFromGacetaForm';
import { captacionCompletarBodySchema } from '@/lib/registro/captacionPlanillaSchema';
import type { GacetaPostulacionFormState } from '@/lib/registro/gacetaPostulacionTypes';
import { PlanillaAnexo1PdfDocument } from '@/lib/talento/PlanillaAnexo1Pdf';
import type { HojaVidaLegalPdfMeta } from '@/lib/talento/hojaVidaPdfLegal';
import { hojaVidaDesdeRow, nombreCompletoDesde } from '@/lib/talento/hojaVidaObreroCompleta';
import { resolvePlanillaPatronoPdf } from '@/lib/talento/resolvePlanillaPatronoPdf';
import { nombresLegadoDesdeGaceta } from '@/lib/registro/ciEmpleadosNombresLegado';
import { ensureCiExamenInviteForEmpleado } from '@/lib/talento/ensureCiExamenInviteForEmpleado';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { friendlyStorageError } from '@/lib/supabase/friendlyStorageError';

export const runtime = 'nodejs';

function trimBase(u: string): string {
  return u.trim().replace(/\/$/, '');
}

function publicBaseFromReq(req: Request): string {
  const origin = trimBase(req.headers.get('origin') ?? '');
  if (origin && /^https?:\/\//i.test(origin)) return origin;
  const env = trimBase(process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
  if (env && /^https?:\/\//i.test(env)) return env;
  try {
    return trimBase(new URL(req.url).origin);
  } catch {
    return '';
  }
}

/**
 * POST — Cierra captación automática: persiste obrero, PDF Anexo I (firma en blanco), Storage, notificación CEO.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = captacionCompletarBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validación', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { token, form: fj, fotoPerfilUrl, fotoCedulaUrl, firma } = parsed.data;

  const { data: need, error: nErr } = await admin.client
    .from('recruitment_needs')
    .select('id,title,cargo_nombre,cargo_codigo,cargo_nivel,tipo_vacante,protocol_active,proyecto_modulo_id')
    .eq('captacion_token', token)
    .maybeSingle();

  if (nErr) {
    return NextResponse.json({ error: nErr.message }, { status: 500 });
  }
  if (!need) {
    return NextResponse.json({ error: 'Token no válido' }, { status: 404 });
  }

  const n = need as {
    id: string;
    title: string | null;
    cargo_nombre: string | null;
    cargo_codigo: string | null;
    cargo_nivel: number | null;
    tipo_vacante: string | null;
    protocol_active: boolean | null;
    proyecto_modulo_id: string | null;
  };

  if (n.protocol_active === false) {
    return NextResponse.json({ error: 'Vacante cerrada' }, { status: 410 });
  }

  const formState = {
    ...fj,
    fotoPerfilFile: null,
    fotoCedulaFile: null,
  } as GacetaPostulacionFormState;

  const cargoEtiqueta =
    (n.cargo_nombre ?? '').trim() || (n.title ?? '').trim() || 'Vacante';

  const hojaBase = buildHojaVidaFromGacetaForm(formState, { fotoPerfil: fotoPerfilUrl, fotoCedula: fotoCedulaUrl }, cargoEtiqueta);
  const planillaSnapCapt = await resolvePlanillaPatronoPdf(admin.client, n.proyecto_modulo_id);
  const empDomCapt = String(planillaSnapCapt.empresaDomicilio ?? '').trim();
  const hoja = empDomCapt ? { ...hojaBase, planillaPatrono: { empresaDomicilio: empDomCapt } } : hojaBase;
  const nombreCompleto =
    `${formState.primerApellido.trim()} ${formState.segundoApellido.trim()}, ${formState.primerNombre.trim()} ${formState.segundoNombre.trim()}`
      .replace(/\s+/g, ' ')
      .trim();

  const familiaresJson = formState.familiares
    .filter((r) => r.nombre.trim() || r.apellido.trim() || r.parentesco.trim())
    .map((r) => ({
      nombre: r.nombre.trim(),
      apellido: r.apellido.trim(),
      parentesco: r.parentesco.trim(),
      fecha_nacimiento: r.fechaNacimiento.trim(),
      no_aplica: r.noAplica,
    }));

  const experienciaJson = formState.experiencia
    .filter((r) => r.empresa.trim() || r.cargo.trim())
    .map((r) => ({
      empresa: r.empresa.trim(),
      lugar: r.lugar.trim(),
      cargo: r.cargo.trim(),
      duracion: r.duracion.trim(),
      fecha_retiro: r.fechaRetiro.trim(),
      motivo_retiro: r.motivoRetiro.trim(),
    }));

  const edadInt = parseInt(formState.edad.trim(), 10);
  const edad = Number.isFinite(edadInt) ? edadInt : null;
  const peso = parseFloat(formState.peso.trim().replace(',', '.'));
  const est = parseFloat(formState.estatura.trim().replace(',', '.'));

  const nombresLegado = nombresLegadoDesdeGaceta(
    { primerNombre: formState.primerNombre, segundoNombre: formState.segundoNombre },
    nombreCompleto || undefined,
  );
  const tokenRegistro = randomUUID();

  const insertPayload: Record<string, unknown> = {
    recruitment_need_id: n.id,
    proyecto_modulo_id: n.proyecto_modulo_id,
    cargo_codigo: n.cargo_codigo,
    cargo_nombre: n.cargo_nombre,
    cargo_nivel: n.cargo_nivel,
    tipo_vacante: n.tipo_vacante,
    nombre_completo: nombreCompleto || 'Postulante',
    nombres: nombresLegado,
    cargo: cargoEtiqueta,
    email: formState.correo.trim(),
    telefono: formState.celular.trim(),
    documento: formState.cedula.trim(),
    cedula: formState.cedula.trim(),
    celular: formState.celular.trim(),
    rol_examen: 'tecnico',
    rol_buscado: cargoEtiqueta,
    respuestas_personalidad: [],
    respuestas_logica: [],
    estado: 'evaluacion_pendiente',
    estado_proceso: 'cv_completado',
    primer_nombre: formState.primerNombre.trim() || null,
    segundo_nombre: formState.segundoNombre.trim() || null,
    primer_apellido: formState.primerApellido.trim() || null,
    segundo_apellido: formState.segundoApellido.trim() || null,
    edad,
    estado_civil: formState.estadoCivil.trim() || null,
    lugar_nacimiento: formState.lugarNacimiento.trim() || null,
    fecha_nacimiento_date: formState.fechaNacimiento.trim() || null,
    fecha_nacimiento: formState.fechaNacimiento.trim() || null,
    nacionalidad: formState.nacionalidad.trim() || null,
    domicilio_declarado: formState.direccion.trim() || null,
    direccion_habitacion: formState.direccion.trim() || null,
    ciudad_estado: formState.lugarNacimiento.trim() || null,
    zurdo: formState.zurdo,
    ivss_inscrito: formState.ivssInscrito,
    educacion_sabe_leer: formState.sabeLeer,
    educacion_primaria: formState.instruccionPrimaria,
    educacion_secundaria: formState.instruccionSecundaria,
    educacion_tecnica: formState.instruccionTecnica,
    educacion_superior: formState.instruccionSuperior,
    profesion_actual: formState.profesionActual.trim() || null,
    antecedentes_penales: antecedentesPenalesJson(formState),
    examen_medico: formState.examenMedico,
    salud_tipo_sangre: formState.tipoSangre.trim() || null,
    salud_enfermedades: formState.enfermedades.trim() || null,
    salud_incapacidades: formState.incapacidades.trim() || null,
    grupo_sanguineo: formState.tipoSangre.trim() || null,
    peso_kg: Number.isFinite(peso) ? peso : null,
    estatura_m: Number.isFinite(est) ? est : null,
    talla_camisa: formState.tallaCamisa.trim() || null,
    talla_pantalon: formState.tallaPantalon.trim() || null,
    talla_bragas: formState.tallaBragas.trim() || null,
    talla_botas: formState.tallaBotas.trim() || null,
    familiares: familiaresJson,
    experiencia_previa: experienciaJson,
    foto_perfil_url: fotoPerfilUrl || null,
    cedula_foto_url: fotoCedulaUrl || null,
    hoja_vida_obrero: hoja,
    token: tokenRegistro,
    token_registro: tokenRegistro,
  };

  const { data: ins, error: insErr } = await admin.client
    .from('ci_empleados')
    .insert(insertPayload as never)
    .select('id')
    .single();

  if (insErr || !ins) {
    return NextResponse.json(
      {
        error: insErr?.message ?? 'No se pudo guardar el obrero.',
        hint: (insErr?.message ?? '').toLowerCase().includes('column')
          ? 'Ejecuta migraciones 065+ en Supabase.'
          : undefined,
      },
      { status: 500 },
    );
  }

  const empleadoId = (ins as { id: string }).id;

  const examInvite = await ensureCiExamenInviteForEmpleado(admin.client, {
    empleadoId,
    token: tokenRegistro,
  });
  if (!examInvite.ok) {
    console.error('[captacion-completar] ci_examenes', examInvite.error);
  }

  const { data: empFull, error: empErr } = await admin.client.from('ci_empleados').select('*').eq('id', empleadoId).maybeSingle();
  if (empErr || !empFull) {
    return NextResponse.json({ ok: true, empleadoId, warning: 'Empleado creado pero no se generó PDF.' });
  }

  const row = empFull as Record<string, unknown>;
  const str = (k: string) => String(row[k] ?? '').trim();
  const completa = hojaVidaDesdeRow(row);
  const emitidoEn = new Date().toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' });
  const planillaPatrono = await resolvePlanillaPatronoPdf(admin.client, str('proyecto_modulo_id') || null);

  const meta: HojaVidaLegalPdfMeta = {
    emitidoEn,
    estadoProceso: str('estado_proceso'),
    rolBuscadoSistema: str('rol_buscado'),
    cargoCodigo: str('cargo_codigo'),
    cargoNombre: str('cargo_nombre'),
    planillaPatrono,
    firmaTrabajador: undefined,
    documentVariant: 'hoja_empleo',
  };

  try {
    const pdfNode = createElement(PlanillaAnexo1PdfDocument, { data: completa, meta });
    const blob = await pdf(pdfNode as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    const path = `captacion/${empleadoId}/planilla-anexo-1.pdf`;
    const { error: upSt } = await admin.client.storage.from('contratos_obreros').upload(path, buf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (upSt) {
      console.error('[captacion-completar] contratos_obreros', friendlyStorageError('contratos_obreros', upSt.message));
    } else {
      await admin.client.from('ci_empleados').update({ planilla_captacion_pdf_url: path } as never).eq('id', empleadoId);
    }
  } catch (e) {
    console.error('[captacion-completar] pdf', e);
  }

  if (firma?.dataUrl && firma.eventId && firma.capturedAtIso) {
    const m = /^data:image\/png;base64,(.+)$/i.exec(firma.dataUrl);
    const cedula = formState.cedula.trim();
    if (m && cedula) {
      try {
        const buffer = Buffer.from(m[1], 'base64');
        const fpath = `${empleadoId}/firma.png`;
        const { error: upF } = await admin.client.storage.from('talento-firmas').upload(fpath, buffer, {
          contentType: 'image/png',
          upsert: true,
        });
        if (upF) {
          console.error('[captacion-completar] talento-firmas', friendlyStorageError('talento-firmas', upF.message));
        }
        if (!upF) {
          const { data: pub } = admin.client.storage.from('talento-firmas').getPublicUrl(fpath);
          const publicUrl = pub?.publicUrl;
          if (publicUrl) {
            await admin.client
              .from('ci_empleados')
              .update({
                firma_electronica_url: publicUrl,
                firma_electronica_id: firma.eventId,
                firma_electronica_at: firma.capturedAtIso,
              } as never)
              .eq('id', empleadoId);
          }
        }
      } catch (e) {
        console.error('[captacion-completar] firma', e);
      }
    }
  }

  const pid = (n.proyecto_modulo_id ?? '').trim();
  if (pid) {
    const nom = nombreCompletoDesde(completa) || nombreCompleto || 'Postulante';
    await admin.client.from('ci_notificaciones').insert({
      proyecto_id: pid,
      mensaje: `Captación automática: ${nom} — planilla PDF lista. Firma / revisión pendiente (CEO / RRHH).`,
      tipo: 'captacion_firma_pendiente',
      empleado_id: empleadoId,
    } as never);
  }

  const { data: cur } = await admin.client.from('recruitment_needs').select('conteo_postulaciones').eq('id', n.id).maybeSingle();
  const prev = (cur as { conteo_postulaciones?: number } | null)?.conteo_postulaciones ?? 0;
  await admin.client.from('recruitment_needs').update({ conteo_postulaciones: prev + 1 } as never).eq('id', n.id);

  const base = publicBaseFromReq(req);
  const exam_url =
    examInvite.ok && base ? `${base}/talento/examen?token=${encodeURIComponent(tokenRegistro)}` : undefined;

  return NextResponse.json({
    ok: true,
    empleadoId,
    cedula: formState.cedula.trim(),
    ...(exam_url ? { exam_url } : {}),
    ...(!examInvite.ok ? { exam_invite_error: examInvite.error } : {}),
  });
}
