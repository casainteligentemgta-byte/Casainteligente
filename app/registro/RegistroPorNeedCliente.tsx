'use client';

import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { antecedentesPenalesJson, buildHojaVidaFromGacetaForm } from '@/lib/registro/buildHojaVidaFromGacetaForm';
import {
  emptyExperienciaPostulacion,
  emptyFamiliarPostulacion,
  initialGacetaPostulacionForm,
  type GacetaPostulacionFormState,
} from '@/lib/registro/gacetaPostulacionTypes';
import {
  captacionFormJsonSchema,
  captacionStep4Schema,
} from '@/lib/registro/captacionPlanillaSchema';
import { nombresLegadoDesdeGaceta } from '@/lib/registro/ciEmpleadosNombresLegado';
import { uploadTalentoPublicFile } from '@/lib/registro/uploadTalentoPublic';
import { apiUrl } from '@/lib/http/apiUrl';
import { createClient } from '@/lib/supabase/client';

import type { FirmaDigitalGuardado } from './components/FirmaDigital';

const FirmaDigital = dynamic(() => import('./components/FirmaDigital'), { ssr: false });

const inputClass =
  'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-[#FF9500] focus:ring-1 focus:ring-[#FF9500]/40';
const labelClass = 'block text-[10px] font-bold uppercase tracking-wide text-zinc-500';

const STEPS_CAPTACION = [
  'Trabajador',
  'Conducta',
  'Educación',
  'Sindicato',
  'Salud',
  'Medidas',
  'Familiares',
  'Trabajos previos',
] as const;
const STEPS_FULL = [
  'Trabajador',
  'Conducta',
  'Educación',
  'Sindicato',
  'Salud',
  'Medidas',
  'Familiares',
  'Trabajos previos',
  'Firma digital',
] as const;

type NeedLoaded = {
  id: string;
  title: string | null;
  cargo_nombre: string | null;
  cargo_codigo: string | null;
  cargo_nivel: number | null;
  tipo_vacante: string | null;
  protocol_active: boolean | null;
  proyecto_modulo_id: string | null;
};

function parseOptionalInt(s: string): number | null {
  const n = parseInt(s.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalNum(s: string): number | null {
  const n = parseFloat(s.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function RegistroPorNeedCliente({
  needId: needIdProp,
  captacionToken: captacionTokenProp,
}: {
  needId?: string;
  captacionToken?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const needId = (needIdProp ?? '').trim();
  const captacionToken = (captacionTokenProp ?? '').trim();
  const captacionMode = Boolean(captacionToken);
  const STEP_LABELS = useMemo(() => (captacionMode ? STEPS_CAPTACION : STEPS_FULL), [captacionMode]);
  const lastStepIndex = STEP_LABELS.length - 1;

  const [metaPhase, setMetaPhase] = useState<'loading' | 'ready' | 'closed' | 'error'>('loading');
  const [metaError, setMetaError] = useState<string | null>(null);
  const [need, setNeed] = useState<NeedLoaded | null>(null);
  const [proyectoNombre, setProyectoNombre] = useState('');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<GacetaPostulacionFormState>(() => initialGacetaPostulacionForm());
  const [firma, setFirma] = useState<FirmaDigitalGuardado | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargoEtiqueta = useMemo(() => {
    const n = (need?.cargo_nombre ?? '').trim() || (need?.title ?? '').trim();
    return n || 'Vacante';
  }, [need]);

  useEffect(() => {
    if (!needId && !captacionToken) {
      setMetaPhase('error');
      setMetaError('Enlace de registro no válido.');
      return;
    }

    let alive = true;
    (async () => {
      setMetaPhase('loading');
      setMetaError(null);

      if (captacionToken) {
        const res = await fetch(`/api/reclutamiento/captacion-meta?token=${encodeURIComponent(captacionToken)}`, {
          cache: 'no-store',
        });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          message?: string;
          need?: NeedLoaded;
          proyectoNombre?: string;
        };
        if (!alive) return;
        if (!res.ok) {
          if (res.status === 410) {
            setMetaPhase('closed');
            setMetaError(null);
            return;
          }
          setMetaPhase('error');
          setMetaError(j.message ?? j.error ?? 'No se pudo validar el enlace.');
          return;
        }
        if (!j.need) {
          setMetaPhase('error');
          setMetaError('Respuesta inválida del servidor.');
          return;
        }
        setNeed(j.need);
        if (j.need.protocol_active === false) {
          setMetaPhase('closed');
          return;
        }
        setProyectoNombre((j.proyectoNombre ?? '').trim());
        setMetaPhase('ready');
        return;
      }

      const { data: row, error } = await supabase
        .from('recruitment_needs')
        .select('id,title,cargo_nombre,cargo_codigo,cargo_nivel,tipo_vacante,protocol_active,proyecto_modulo_id')
        .eq('id', needId)
        .maybeSingle();

      if (!alive) return;
      if (error || !row) {
        setMetaPhase('error');
        setMetaError(error?.message ?? 'No se encontró la vacante o el enlace expiró.');
        return;
      }
      const n = row as NeedLoaded;
      setNeed(n);
      if (n.protocol_active === false) {
        setMetaPhase('closed');
        return;
      }
      let pn = '';
      const pid = (n.proyecto_modulo_id ?? '').trim();
      if (pid) {
        const { data: pr } = await supabase.from('ci_proyectos').select('nombre').eq('id', pid).maybeSingle();
        if (alive) pn = String((pr as { nombre?: string } | null)?.nombre ?? '').trim();
      }
      if (alive) {
        setProyectoNombre(pn);
        setMetaPhase('ready');
      }
    })();
    return () => {
      alive = false;
    };
  }, [needId, captacionToken, supabase]);

  const setF = useCallback(<K extends keyof GacetaPostulacionFormState>(key: K, value: GacetaPostulacionFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  function validarPaso(i: number): string | null {
    if (i === 0) {
      if (!form.primerNombre.trim()) return 'Indica al menos el primer nombre.';
      if (!form.primerApellido.trim()) return 'Indica al menos el primer apellido.';
      if (!form.cedula.trim()) return 'Indica la cédula.';
      if (!form.celular.trim()) return 'Indica el celular.';
      if (!form.correo.trim()) return 'Indica el correo electrónico.';
      if (!form.direccion.trim()) return 'Indica la dirección / domicilio.';
      if (!form.fechaNacimiento.trim()) return 'Indica la fecha de nacimiento.';
      if (!form.fotoPerfilFile) return 'Sube la foto de perfil (tipo carnet).';
      if (!form.fotoCedulaFile) return 'Sube la foto de la cédula.';
    }
    if (i === 1) {
      if (!form.antecedentes.tiene) return 'Indica si tiene antecedentes penales (sí / no).';
    }
    if (i === 4) {
      if (
        form.examenMedico &&
        (!form.examenMedicoEfectuadoPor.trim() || !form.examenMedicoFecha.trim())
      ) {
        return 'Si hubo examen médico previo, indica efectuado por y la fecha.';
      }
    }
    const firmaStep = captacionMode ? -1 : 8;
    if (i === firmaStep && !captacionMode) {
      if (!firma) return 'Dibuja y pulsa «Guardar firma» antes de enviar la postulación.';
    }
    return null;
  }

  async function onSubmit() {
    for (let s = 0; s < STEP_LABELS.length; s++) {
      const err = validarPaso(s);
      if (err) {
        toast.error(err);
        setStep(s);
        return;
      }
    }

    if (captacionMode) {
      const p4 = captacionStep4Schema.safeParse({ familiares: form.familiares, experiencia: form.experiencia });
      if (!p4.success) {
        const msg = p4.error.flatten().formErrors[0] ?? 'Revisa familiares y al menos dos empleos anteriores.';
        toast.error(msg);
        setStep(7);
        return;
      }
      const { fotoPerfilFile: _fp, fotoCedulaFile: _fc, ...formJson } = form;
      const parsed = captacionFormJsonSchema.safeParse(formJson);
      if (!parsed.success) {
        toast.error('Revisa los datos del formulario antes de enviar.');
        setStep(0);
        return;
      }
    }

    if (!need) return;
    setEnviando(true);
    try {
      const needRowId = need.id;
      const stagingId = crypto.randomUUID();
      let fotoPerfil = '';
      let fotoCedula = '';
      if (form.fotoPerfilFile) {
        const up = await uploadTalentoPublicFile(supabase, {
          needId: needRowId,
          stagingId,
          kind: 'perfil',
          file: form.fotoPerfilFile,
        });
        if (up.error || !up.publicUrl) {
          toast.error(up.error ?? 'No se pudo subir la foto de perfil.');
          return;
        }
        fotoPerfil = up.publicUrl;
      }
      if (form.fotoCedulaFile) {
        const up = await uploadTalentoPublicFile(supabase, {
          needId: needRowId,
          stagingId,
          kind: 'cedula',
          file: form.fotoCedulaFile,
        });
        if (up.error || !up.publicUrl) {
          toast.error(up.error ?? 'No se pudo subir la foto de cédula.');
          return;
        }
        fotoCedula = up.publicUrl;
      }

      if (captacionMode) {
        const res = await fetch('/api/reclutamiento/captacion-completar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: captacionToken,
            form: {
              ...form,
              fotoPerfilFile: undefined,
              fotoCedulaFile: undefined,
            },
            fotoPerfilUrl: fotoPerfil,
            fotoCedulaUrl: fotoCedula,
            firma: firma
              ? { dataUrl: firma.dataUrl, eventId: firma.eventId, capturedAtIso: firma.capturedAtIso }
              : undefined,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          hint?: string;
          empleadoId?: string;
          exam_url?: string;
          exam_invite_error?: string;
        };
        if (!res.ok) {
          toast.error(body.error ?? 'No se pudo completar la captación automática.');
          if (body.hint) toast.message(String(body.hint));
          return;
        }
        const eid = (body.empleadoId ?? '').trim();
        if (body.exam_url && eid && typeof window !== 'undefined') {
          const nombrePost =
            `${form.primerNombre.trim()} ${form.primerApellido.trim()}`.replace(/\s+/g, ' ').trim() || 'Postulante';
          window.sessionStorage.setItem(
            `registro-examen-${eid}`,
            JSON.stringify({
              examUrl: body.exam_url,
              nombre: nombrePost,
              whatsapp: form.celular.trim(),
            }),
          );
        } else if (body.exam_invite_error) {
          toast.message(`Enlace de evaluación no disponible: ${body.exam_invite_error}`);
        }
        toast.success('Planilla enviada. PDF generado; pendiente de firma / revisión.');
        router.push(
          `/registro/exito?empleadoId=${encodeURIComponent(eid)}&cedula=${encodeURIComponent(form.cedula.trim())}`,
        );
        return;
      }

      const hoja = buildHojaVidaFromGacetaForm(form, { fotoPerfil, fotoCedula: fotoCedula }, cargoEtiqueta);
      const nombreCompleto =
        `${form.primerApellido.trim()} ${form.segundoApellido.trim()}, ${form.primerNombre.trim()} ${form.segundoNombre.trim()}`
          .replace(/\s+/g, ' ')
          .trim();

      const familiaresJson = form.familiares
        .filter((r) => r.nombre.trim() || r.apellido.trim() || r.parentesco.trim())
        .map((r) => ({
          nombre: r.nombre.trim(),
          apellido: r.apellido.trim(),
          parentesco: r.parentesco.trim(),
          fecha_nacimiento: r.fechaNacimiento.trim(),
          no_aplica: r.noAplica,
          observaciones: r.observaciones.trim() || null,
        }));

      const experienciaJson = form.experiencia
        .filter((r) => r.empresa.trim() || r.cargo.trim())
        .map((r) => ({
          empresa: r.empresa.trim(),
          lugar: r.lugar.trim(),
          cargo: r.cargo.trim(),
          duracion: r.duracion.trim(),
          fecha_retiro: r.fechaRetiro.trim(),
          motivo_retiro: r.motivoRetiro.trim(),
        }));

      const edadInt = parseOptionalInt(form.edad);
      const peso = parseOptionalNum(form.peso);
      const est = parseOptionalNum(form.estatura);

      const nombresLegado = nombresLegadoDesdeGaceta(
        { primerNombre: form.primerNombre, segundoNombre: form.segundoNombre },
        nombreCompleto || undefined,
      );
      const tokenRegistro = globalThis.crypto.randomUUID();

      const insertPayload: Record<string, unknown> = {
        recruitment_need_id: needRowId,
        proyecto_modulo_id: need.proyecto_modulo_id,
        cargo_codigo: need.cargo_codigo,
        cargo_nombre: need.cargo_nombre,
        cargo_nivel: need.cargo_nivel,
        tipo_vacante: need.tipo_vacante,
        nombre_completo: nombreCompleto || 'Postulante',
        nombres: nombresLegado,
        cargo: cargoEtiqueta,
        email: form.correo.trim(),
        telefono: form.celular.trim(),
        documento: form.cedula.trim(),
        cedula: form.cedula.trim(),
        celular: form.celular.trim(),
        rol_examen: 'tecnico',
        rol_buscado: cargoEtiqueta,
        respuestas_personalidad: [],
        respuestas_logica: [],
        estado: 'evaluacion_pendiente',
        estado_proceso: 'cv_completado',
        primer_nombre: form.primerNombre.trim() || null,
        segundo_nombre: form.segundoNombre.trim() || null,
        primer_apellido: form.primerApellido.trim() || null,
        segundo_apellido: form.segundoApellido.trim() || null,
        edad: edadInt,
        estado_civil: form.estadoCivil.trim() || null,
        lugar_nacimiento: form.lugarNacimiento.trim() || null,
        fecha_nacimiento_date: form.fechaNacimiento.trim() || null,
        fecha_nacimiento: form.fechaNacimiento.trim() || null,
        nacionalidad: form.nacionalidad.trim() || null,
        domicilio_declarado: form.direccion.trim() || null,
        direccion_habitacion: form.direccion.trim() || null,
        ciudad_estado: form.lugarNacimiento.trim() || null,
        zurdo: form.zurdo,
        ivss_inscrito: form.ivssInscrito,
        educacion_sabe_leer: form.sabeLeer,
        educacion_primaria: form.instruccionPrimaria,
        educacion_secundaria: form.instruccionSecundaria,
        educacion_tecnica: form.instruccionTecnica,
        educacion_superior: form.instruccionSuperior,
        profesion_actual: form.profesionActual.trim() || null,
        antecedentes_penales: antecedentesPenalesJson(form),
        examen_medico: form.examenMedico,
        salud_tipo_sangre: form.tipoSangre.trim() || null,
        salud_enfermedades: form.enfermedades.trim() || null,
        salud_incapacidades: form.incapacidades.trim() || null,
        grupo_sanguineo: form.tipoSangre.trim() || null,
        peso_kg: peso,
        estatura_m: est,
        talla_camisa: form.tallaCamisa.trim() || null,
        talla_pantalon: form.tallaPantalon.trim() || null,
        talla_bragas: form.tallaBragas.trim() || null,
        talla_botas: form.tallaBotas.trim() || null,
        familiares: familiaresJson,
        experiencia_previa: experienciaJson,
        foto_perfil_url: fotoPerfil || null,
        cedula_foto_url: fotoCedula || null,
        hoja_vida_obrero: hoja,
        token: tokenRegistro,
        token_registro: tokenRegistro,
      };

      const { data: ins, error: insErr } = await supabase.from('ci_empleados').insert(insertPayload).select('id').single();

      if (insErr || !ins) {
        toast.error(insErr?.message ?? 'No se pudo guardar la postulación.');
        if ((insErr?.message ?? '').toLowerCase().includes('column')) {
          toast.info('Ejecuta en Supabase la migración 065_gaceta_postulacion_empleados_storage.sql y recarga el esquema.');
        }
        return;
      }

      const { data: cur } = await supabase
        .from('recruitment_needs')
        .select('conteo_postulaciones')
        .eq('id', needRowId)
        .maybeSingle();
      const prev = (cur as { conteo_postulaciones?: number } | null)?.conteo_postulaciones ?? 0;
      const { error: upNeed } = await supabase
        .from('recruitment_needs')
        .update({ conteo_postulaciones: prev + 1 })
        .eq('id', needRowId);
      if (upNeed) {
        toast.message('Postulación guardada; no se pudo actualizar el contador de la vacante.', { description: upNeed.message });
      } else {
        toast.success('Postulación registrada.');
      }

      if (firma) {
        const resFirma = await fetch('/api/registro/subir-firma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empleadoId: ins.id,
            dataUrl: firma.dataUrl,
            eventId: firma.eventId,
            capturedAtIso: firma.capturedAtIso,
            cedula: form.cedula.trim(),
          }),
        });
        const bodyFirma = (await resFirma.json().catch(() => ({}))) as { error?: string };
        if (!resFirma.ok) {
          toast.error(bodyFirma.error ?? 'No se pudo almacenar la firma electrónica.', {
            description:
              'Tu postulación ya quedó registrada. Puedes imprimir la planilla; RRHH puede volver a cargar la firma o usar firma física.',
          });
        }
      }

      try {
        const inv = await fetch(apiUrl('/api/registro/emitir-invitacion-examen'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empleadoId: ins.id, cedula: form.cedula.trim() }),
        });
        const ij = (await inv.json().catch(() => ({}))) as { exam_url?: string; error?: string };
        if (inv.ok && ij.exam_url && typeof window !== 'undefined') {
          window.sessionStorage.setItem(
            `registro-examen-${ins.id}`,
            JSON.stringify({
              examUrl: ij.exam_url,
              nombre: nombreCompleto || 'Postulante',
              whatsapp: form.celular.trim(),
            }),
          );
        } else if (!inv.ok && ij.error) {
          toast.message(ij.error);
        }
      } catch {
        /* sin bloquear éxito de postulación */
      }

      router.push(
        `/registro/exito?empleadoId=${encodeURIComponent(ins.id)}&cedula=${encodeURIComponent(form.cedula.trim())}`,
      );
    } finally {
      setEnviando(false);
    }
  }

  if (metaPhase === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-4">
        <p className="text-sm text-zinc-400">Cargando vacante…</p>
      </div>
    );
  }

  if (metaPhase === 'error') {
    return (
      <div className="min-h-screen bg-[#0A0A0F] px-4 py-12 text-zinc-100">
        <div className="mx-auto max-w-md rounded-2xl border border-red-500/25 bg-red-950/20 p-6">
          <h1 className="text-lg font-bold text-white">No disponible</h1>
          <p className="mt-2 text-sm text-red-200/90">{metaError}</p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[#FF9500] hover:underline">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (metaPhase === 'closed') {
    return (
      <div className="min-h-screen bg-[#0A0A0F] px-4 py-12 text-zinc-100">
        <div className="mx-auto max-w-md rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6">
          <h1 className="text-lg font-bold text-white">Vacante cerrada</h1>
          <p className="mt-2 text-sm text-amber-100/90">Esta necesidad ya no acepta postulaciones públicas.</p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[#FF9500] hover:underline">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-24 pt-8 text-zinc-100">
      <div className="mx-auto max-w-lg px-4">
        <header className="rounded-2xl border border-[#FF9500]/25 bg-gradient-to-br from-[#FF9500]/10 to-transparent p-5 shadow-lg shadow-black/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFD60A]/90">Casa Inteligente</p>
          <h1 className="mt-2 text-xl font-bold leading-snug text-white">Postulación para: {cargoEtiqueta}</h1>
          {proyectoNombre ? (
            <p className="mt-2 text-sm text-zinc-300">
              Proyecto: <span className="font-semibold text-white">{proyectoNombre}</span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">Proyecto no vinculado o sin nombre en sistema.</p>
          )}
        </header>

        <nav className="mt-6 flex gap-1 overflow-x-auto pb-1" aria-label="Pasos">
          {STEP_LABELS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setStep(i)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                step === i
                  ? 'bg-[#FF9500] text-black'
                  : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
              }`}
            >
              {i + 1}. {t}
            </button>
          ))}
        </nav>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">1. Trabajador — datos personales</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Primer nombre *</label>
                  <input className={inputClass} value={form.primerNombre} onChange={(e) => setF('primerNombre', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Segundo nombre</label>
                  <input className={inputClass} value={form.segundoNombre} onChange={(e) => setF('segundoNombre', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Primer apellido *</label>
                  <input className={inputClass} value={form.primerApellido} onChange={(e) => setF('primerApellido', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Segundo apellido</label>
                  <input
                    className={inputClass}
                    value={form.segundoApellido}
                    onChange={(e) => setF('segundoApellido', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Cédula *</label>
                  <input className={inputClass} value={form.cedula} onChange={(e) => setF('cedula', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Edad (años)</label>
                  <input className={inputClass} inputMode="numeric" value={form.edad} onChange={(e) => setF('edad', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Estado civil</label>
                  <input className={inputClass} value={form.estadoCivil} onChange={(e) => setF('estadoCivil', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Lugar de nacimiento</label>
                  <input
                    className={inputClass}
                    value={form.lugarNacimiento}
                    onChange={(e) => setF('lugarNacimiento', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>País de nacimiento</label>
                  <input className={inputClass} value={form.paisNacimiento} onChange={(e) => setF('paisNacimiento', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Fecha de nacimiento *</label>
                <input
                  type="date"
                  className={inputClass}
                  style={{ colorScheme: 'dark' }}
                  value={form.fechaNacimiento}
                  onChange={(e) => setF('fechaNacimiento', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Nacionalidad</label>
                <input className={inputClass} value={form.nacionalidad} onChange={(e) => setF('nacionalidad', e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Celular *</label>
                  <input className={inputClass} inputMode="tel" value={form.celular} onChange={(e) => setF('celular', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Correo *</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={form.correo}
                    onChange={(e) => setF('correo', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Dirección / domicilio *</label>
                <textarea className={`${inputClass} resize-y`} rows={3} value={form.direccion} onChange={(e) => setF('direccion', e.target.value)} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.zurdo} onChange={(e) => setF('zurdo', e.target.checked)} className="rounded border-white/20" />
                Zurdo
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.ivssInscrito}
                  onChange={(e) => setF('ivssInscrito', e.target.checked)}
                  className="rounded border-white/20"
                />
                Inscrito en el IVSS
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Clase de visa</label>
                  <input className={inputClass} value={form.visaClase} onChange={(e) => setF('visaClase', e.target.value)} placeholder="Si no aplica, en blanco" />
                </div>
                <div>
                  <label className={labelClass}>Validez hasta</label>
                  <input
                    type="date"
                    className={inputClass}
                    style={{ colorScheme: 'dark' }}
                    value={form.visaValidezHasta}
                    onChange={(e) => setF('visaValidezHasta', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Foto de perfil (carnet) *</label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200"
                  onChange={(e) => setF('fotoPerfilFile', e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className={labelClass}>Foto de cédula *</label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200"
                  onChange={(e) => setF('fotoCedulaFile', e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">2. Conducta — antecedentes penales</h2>
              <div>
                <p className={labelClass}>Antecedentes penales *</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {(['no', 'si'] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 text-zinc-300">
                      <input
                        type="radio"
                        name="pen"
                        checked={form.antecedentes.tiene === v}
                        onChange={() => setForm((p) => ({ ...p, antecedentes: { ...p.antecedentes, tiene: v } }))}
                      />
                      {v === 'si' ? 'Sí' : 'No'}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Expedido por</label>
                <input
                  className={inputClass}
                  value={form.antecedentes.expedidoPor}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, antecedentes: { ...p.antecedentes, expedidoPor: e.target.value } }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Lugar</label>
                  <input
                    className={inputClass}
                    value={form.antecedentes.lugar}
                    onChange={(e) => setForm((p) => ({ ...p, antecedentes: { ...p.antecedentes, lugar: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Fecha</label>
                  <input
                    type="date"
                    className={inputClass}
                    style={{ colorScheme: 'dark' }}
                    value={form.antecedentes.fechaExpedicion}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, antecedentes: { ...p.antecedentes, fechaExpedicion: e.target.value } }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">3. Educación</h2>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.sabeLeer} onChange={(e) => setF('sabeLeer', e.target.checked)} />
                Sabe leer y escribir
              </label>
              {(
                [
                  ['instruccionPrimaria', 'Instrucción primaria'],
                  ['instruccionSecundaria', 'Instrucción secundaria'],
                  ['instruccionTecnica', 'Técnica'],
                  ['instruccionSuperior', 'Superior'],
                ] as const
              ).map(([k, lab]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={form[k]} onChange={(e) => setF(k, e.target.checked)} />
                  {lab}
                </label>
              ))}
              <div>
                <label className={labelClass}>Profesión u oficio actual</label>
                <input className={inputClass} value={form.profesionActual} onChange={(e) => setF('profesionActual', e.target.value)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">4. Sindicato — actividad gremial</h2>
              <div>
                <label className={labelClass}>Federación sindical</label>
                <input
                  className={inputClass}
                  value={form.sindicatoFederacion}
                  onChange={(e) => setF('sindicatoFederacion', e.target.value)}
                  placeholder="Si no aplica, en blanco"
                />
              </div>
              <div>
                <label className={labelClass}>Gremio o asociación a la que pertenece</label>
                <input
                  className={inputClass}
                  value={form.sindicatoOrganizacion}
                  onChange={(e) => setF('sindicatoOrganizacion', e.target.value)}
                  placeholder="Si no aplica, en blanco"
                />
              </div>
              <div>
                <label className={labelClass}>Cargo que ejerce</label>
                <input className={inputClass} value={form.sindicatoCargo} onChange={(e) => setF('sindicatoCargo', e.target.value)} placeholder="Si no aplica, en blanco" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">5. Salud</h2>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.examenMedico} onChange={(e) => setF('examenMedico', e.target.checked)} />
                Examen médico previo (sí)
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Efectuado por</label>
                  <input className={inputClass} value={form.examenMedicoEfectuadoPor} onChange={(e) => setF('examenMedicoEfectuadoPor', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Fecha del examen médico</label>
                  <input
                    type="date"
                    className={inputClass}
                    style={{ colorScheme: 'dark' }}
                    value={form.examenMedicoFecha}
                    onChange={(e) => setF('examenMedicoFecha', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Tipo de sangre</label>
                <input className={inputClass} value={form.tipoSangre} onChange={(e) => setF('tipoSangre', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Enfermedades padecidas</label>
                <textarea className={`${inputClass} resize-y`} rows={2} value={form.enfermedades} onChange={(e) => setF('enfermedades', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Incapacidades físicas o funcionales</label>
                <textarea className={`${inputClass} resize-y`} rows={2} value={form.incapacidades} onChange={(e) => setF('incapacidades', e.target.value)} />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">6. Medidas</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Peso (kg)</label>
                  <input className={inputClass} value={form.peso} onChange={(e) => setF('peso', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Estatura (m)</label>
                  <input className={inputClass} value={form.estatura} onChange={(e) => setF('estatura', e.target.value)} />
                </div>
                {(
                  [
                    ['tallaBragas', 'Talla braga'],
                    ['tallaCamisa', 'Talla camisa'],
                    ['tallaPantalon', 'Talla pantalón'],
                    ['tallaBotas', 'Medidas / Nº botas'],
                  ] as const
                ).map(([k, lab]) => (
                  <div key={k}>
                    <label className={labelClass}>{lab}</label>
                    <input className={inputClass} value={form[k]} onChange={(e) => setF(k, e.target.value)} />
                  </div>
                ))}
              </div>
              <div>
                <label className={labelClass}>Observaciones</label>
                <textarea
                  className={`${inputClass} resize-y`}
                  rows={2}
                  value={form.medidasObservaciones}
                  onChange={(e) => setF('medidasObservaciones', e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">7. Familiares (hasta 5)</h2>
              {form.familiares.map((row, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#FFD60A]/80">Familiar {idx + 1}</span>
                    {!captacionMode && form.familiares.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            familiares: p.familiares.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-red-400 hover:text-red-300"
                        aria-label="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      placeholder="Nombre"
                      className={inputClass}
                      value={row.nombre}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          familiares: p.familiares.map((r, i) => (i === idx ? { ...r, nombre: v } : r)),
                        }));
                      }}
                    />
                    <input
                      placeholder="Apellido"
                      className={inputClass}
                      value={row.apellido}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          familiares: p.familiares.map((r, i) => (i === idx ? { ...r, apellido: v } : r)),
                        }));
                      }}
                    />
                    <input
                      placeholder="Parentesco"
                      className={inputClass}
                      value={row.parentesco}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          familiares: p.familiares.map((r, i) => (i === idx ? { ...r, parentesco: v } : r)),
                        }));
                      }}
                    />
                    <input
                      type="date"
                      style={{ colorScheme: 'dark' }}
                      className={inputClass}
                      value={row.fechaNacimiento}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          familiares: p.familiares.map((r, i) => (i === idx ? { ...r, fechaNacimiento: v } : r)),
                        }));
                      }}
                    />
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={row.noAplica}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setForm((p) => ({
                          ...p,
                          familiares: p.familiares.map((r, i) => (i === idx ? { ...r, noAplica: v } : r)),
                        }));
                      }}
                    />
                    No aplica / no informa
                  </label>
                  <div className="mt-2">
                    <label className={labelClass}>Observaciones</label>
                    <textarea
                      className={`${inputClass} resize-y mt-1`}
                      rows={2}
                      value={row.observaciones}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          familiares: p.familiares.map((r, i) => (i === idx ? { ...r, observaciones: v } : r)),
                        }));
                      }}
                    />
                  </div>
                </div>
              ))}
              {!captacionMode && form.familiares.length < 12 ? (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, familiares: [...p.familiares, emptyFamiliarPostulacion()] }))}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-2.5 text-xs font-semibold text-zinc-400 hover:border-[#FF9500]/40 hover:text-[#FFD60A]"
                >
                  <Plus className="h-4 w-4" /> Añadir familiar
                </button>
              ) : null}
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">8. Trabajos previos (dos empleos anteriores)</h2>
              {form.experiencia.map((row, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#FFD60A]/80">Experiencia {idx + 1}</span>
                    {!captacionMode && form.experiencia.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            experiencia: p.experiencia.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-red-400 hover:text-red-300"
                        aria-label="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <input
                      placeholder="Patrono"
                      className={inputClass}
                      value={row.empresa}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          experiencia: p.experiencia.map((r, i) => (i === idx ? { ...r, empresa: v } : r)),
                        }));
                      }}
                    />
                    <input
                      placeholder="Lugar"
                      className={inputClass}
                      value={row.lugar}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          experiencia: p.experiencia.map((r, i) => (i === idx ? { ...r, lugar: v } : r)),
                        }));
                      }}
                    />
                    <input
                      placeholder="Oficio o cargo"
                      className={inputClass}
                      value={row.cargo}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          experiencia: p.experiencia.map((r, i) => (i === idx ? { ...r, cargo: v } : r)),
                        }));
                      }}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        placeholder="Duración"
                        className={inputClass}
                        value={row.duracion}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((p) => ({
                            ...p,
                            experiencia: p.experiencia.map((r, i) => (i === idx ? { ...r, duracion: v } : r)),
                          }));
                        }}
                      />
                      <input
                        type="date"
                        style={{ colorScheme: 'dark' }}
                        className={inputClass}
                        value={row.fechaRetiro}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((p) => ({
                            ...p,
                            experiencia: p.experiencia.map((r, i) => (i === idx ? { ...r, fechaRetiro: v } : r)),
                          }));
                        }}
                      />
                    </div>
                    <input
                      placeholder="Motivo del retiro"
                      className={inputClass}
                      value={row.motivoRetiro}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          experiencia: p.experiencia.map((r, i) => (i === idx ? { ...r, motivoRetiro: v } : r)),
                        }));
                      }}
                    />
                  </div>
                </div>
              ))}
              {!captacionMode ? (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, experiencia: [...p.experiencia, emptyExperienciaPostulacion()] }))}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-2.5 text-xs font-semibold text-zinc-400 hover:border-[#FF9500]/40 hover:text-[#FFD60A]"
                >
                  <Plus className="h-4 w-4" /> Añadir experiencia
                </button>
              ) : null}
            </div>
          )}

          {step === 8 && !captacionMode && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-white">Firma digital (planilla legal)</h2>
              <p className="text-xs text-zinc-500">
                Tu firma quedará en la planilla impresa con trazabilidad; en papel podrás completar firma manuscrita y huella
                según LOTTT y normativa sectorial.
              </p>
              <FirmaDigital value={firma} onChange={setFirma} disabled={enviando} />
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 min-[400px]:flex-none"
            >
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
          ) : (
            <span className="flex-1 min-[400px]:flex-none" />
          )}
          {step < lastStepIndex ? (
            <button
              type="button"
              onClick={() => {
                const err = validarPaso(step);
                if (err) {
                  toast.error(err);
                  return;
                }
                setStep((s) => s + 1);
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF9500] to-orange-700 px-4 py-3 text-sm font-bold text-black min-[400px]:flex-none"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={enviando}
              onClick={() => void onSubmit()}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[#FF9500] to-orange-700 px-4 py-3 text-sm font-bold text-black disabled:opacity-50 min-[400px]:flex-[2]"
            >
              {enviando ? 'Enviando…' : 'Finalizar postulación y enviar a revisión'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
