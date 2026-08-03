'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import {
  emptyHojaVidaObreroCompleta,
  hojaVidaDesdeRow,
  nombreCompletoDesde,
  type HojaVidaObreroCompleta,
} from '@/lib/talento/hojaVidaObreroCompleta';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';
import { resolvePlanillaPatronoParaEmpleado } from '@/lib/talento/resolvePlanillaPatronoPdf';
import { celularParaInserto } from '@/lib/registro/ciEmpleadosCelular';

const HojaVidaObreroVista = dynamic(() => import('@/components/talento/HojaVidaObreroVista'), {
  ssr: false,
  loading: () => <p className="text-center text-sm text-zinc-500 py-6">Cargando vista…</p>,
});

const OnboardingHojaVidaLegalForm = dynamic(() => import('@/components/reclutamiento/OnboardingHojaVidaLegalForm'), {
  ssr: false,
  loading: () => <p className="text-sm text-zinc-500 py-4">Cargando formulario…</p>,
});

import { GlassCard, GlassCardMotion } from '@/components/nexus/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';

import DocumentUpload from '@/components/reclutamiento/DocumentUpload';
import {
  uploadOnboardingCedulaPhoto,
  uploadOnboardingPerfilPhoto,
} from '@/lib/reclutamiento/uploadReclutamientoMedia';
import { apiUrl } from '@/lib/http/apiUrl';
import { urlSiguientePostHv } from '@/lib/talento/flujoHvEvaluacion';

type Props = { params: { token: string } };

const TOTAL_PASOS = 4;
const REDIRECT_EVAL_SEG = 4;

function HojaDeVidaMovilInner({ params }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'compress' | 'upload' | 'save' | 'pdf'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cedulaFoto, setCedulaFoto] = useState<File | null>(null);
  const [cedulaFotoUrl, setCedulaFotoUrl] = useState<string | null>(null);
  const [perfilFoto, setPerfilFoto] = useState<File | null>(null);
  const [perfilFotoUrl, setPerfilFotoUrl] = useState<string | null>(null);
  const [mostrarVista, setMostrarVista] = useState(false);
  const [formData, setFormData] = useState({
    cedula: '',
    talla_camisa: 'M',
    talla_botas: '40',
  });
  const [legal, setLegal] = useState<HojaVidaObreroCompleta>(() => emptyHojaVidaObreroCompleta());
  const [planillaPatrono, setPlanillaPatrono] = useState<PlanillaPatronoCampos | null>(null);
  const [tokenValidando, setTokenValidando] = useState(true);
  const [tokenInvalido, setTokenInvalido] = useState<string | null>(null);
  const [redirectSeg, setRedirectSeg] = useState<number | null>(null);

  useEffect(() => {
    if (step !== 4) return;
    setRedirectSeg(REDIRECT_EVAL_SEG);
    const tick = window.setInterval(() => {
      setRedirectSeg((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          window.clearInterval(tick);
          window.location.href = urlSiguientePostHv(params.token);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [step, params.token]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setTokenValidando(true);
      setTokenInvalido(null);
      try {
        const res = await fetch(apiUrl('/api/expediente/validar-token'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: params.token }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          valid?: boolean;
          error?: string;
          empleado?: { nombre?: string; cargo?: string };
        };
        if (!alive) return;
        if (!res.ok || !j.valid) {
          setTokenInvalido(j.error ?? 'Enlace no válido o inexistente');
          setTokenValidando(false);
          return;
        }

        const { data, error: err } = await supabase
          .from('ci_empleados')
          .select('*')
          .eq('token_registro', params.token)
          .maybeSingle();
        if (!alive) return;
        if (err || !data) {
          const leg = await supabase.from('ci_empleados').select('*').eq('token', params.token).maybeSingle();
          if (!alive || leg.error || !leg.data) {
            setTokenInvalido('No se encontró el expediente del enlace');
            setTokenValidando(false);
            return;
          }
          const rowLeg = leg.data as Record<string, unknown>;
          const hvLeg = hojaVidaDesdeRow(rowLeg);
          if (j.empleado?.cargo && !hvLeg.contratacion.cargoUOficio.trim()) {
            hvLeg.contratacion.cargoUOficio = j.empleado.cargo.trim();
          }
          setLegal(hvLeg);
          setFormData((prev) => ({
            ...prev,
            cedula: hvLeg.datosPersonales.cedulaIdentidad.trim() || prev.cedula,
          }));
          if (hvLeg.datosPersonales.fotoCedulaUrl) setCedulaFotoUrl(hvLeg.datosPersonales.fotoCedulaUrl);
          if (hvLeg.datosPersonales.fotoUrl) setPerfilFotoUrl(hvLeg.datosPersonales.fotoUrl);
          try {
            const campos = await resolvePlanillaPatronoParaEmpleado(supabase, rowLeg);
            if (alive) setPlanillaPatrono(campos);
          } catch {
            if (alive) setPlanillaPatrono(null);
          }
          setTokenValidando(false);
          return;
        }

        const row = data as Record<string, unknown>;
        const hv = hojaVidaDesdeRow(row);
        if (j.empleado?.cargo && !hv.contratacion.cargoUOficio.trim()) {
          hv.contratacion.cargoUOficio = j.empleado.cargo.trim();
        }
        setLegal(hv);
        setFormData((prev) => ({
          ...prev,
          cedula: hv.datosPersonales.cedulaIdentidad.trim() || prev.cedula,
        }));
        if (hv.datosPersonales.fotoCedulaUrl) setCedulaFotoUrl(hv.datosPersonales.fotoCedulaUrl);
        if (hv.datosPersonales.fotoUrl) setPerfilFotoUrl(hv.datosPersonales.fotoUrl);
        try {
          const campos = await resolvePlanillaPatronoParaEmpleado(supabase, row);
          if (alive) setPlanillaPatrono(campos);
        } catch {
          if (alive) setPlanillaPatrono(null);
        }
      } catch {
        if (alive) setTokenInvalido('No se pudo validar el enlace. Revisa tu conexión.');
      } finally {
        if (alive) setTokenValidando(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.token, supabase]);

  async function handleNext() {
    if (step === 1) {
      if (!formData.cedula.trim()) {
        setError('Ingresa la cédula para continuar.');
        return;
      }
      const tieneCedula = Boolean(cedulaFoto || cedulaFotoUrl || legal.datosPersonales.fotoCedulaUrl.trim());
      const tienePerfil = Boolean(perfilFoto || perfilFotoUrl || legal.datosPersonales.fotoUrl.trim());
      if (!tieneCedula || !tienePerfil) {
        setError('Adjunta foto de perfil (carnet) y foto de cédula para continuar.');
        return;
      }
      setError(null);
      setStep(2);
      return;
    }

    if (step === 2) {
      setLegal((prev) => ({
        ...prev,
        datosPersonales: {
          ...prev.datosPersonales,
          cedulaIdentidad: formData.cedula.trim() || prev.datosPersonales.cedulaIdentidad,
        },
        pesoMedidas: {
          ...prev.pesoMedidas,
          tallaCamisa: formData.talla_camisa,
          medidaBotas: String(formData.talla_botas),
        },
      }));
      setError(null);
      setStep(3);
      return;
    }

    if (step !== 3) return;

    setIsSubmitting(true);
    setSubmitPhase('idle');
    setError(null);
    let fotoCedUrl: string | null = cedulaFotoUrl || legal.datosPersonales.fotoCedulaUrl || null;
    let fotoPerUrl: string | null = perfilFotoUrl || legal.datosPersonales.fotoUrl || null;
    try {
      setSubmitPhase('upload');
      if (cedulaFoto && !fotoCedUrl) {
        const up = await uploadOnboardingCedulaPhoto(cedulaFoto, params.token, supabase);
        if (up.error) {
          setIsSubmitting(false);
          setSubmitPhase('idle');
          setError(up.error);
          return;
        }
        fotoCedUrl = up.url;
        if (up.url) setCedulaFotoUrl(up.url);
      }
      if (perfilFoto && !fotoPerUrl) {
        const up = await uploadOnboardingPerfilPhoto(perfilFoto, params.token, supabase);
        if (up.error) {
          setIsSubmitting(false);
          setSubmitPhase('idle');
          setError(up.error);
          return;
        }
        fotoPerUrl = up.url;
        if (up.url) setPerfilFotoUrl(up.url);
      }
      setSubmitPhase('save');
    } catch (e) {
      setIsSubmitting(false);
      setSubmitPhase('idle');
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen.');
      return;
    }

    const merged: HojaVidaObreroCompleta = {
      ...legal,
      datosPersonales: {
        ...legal.datosPersonales,
        cedulaIdentidad: legal.datosPersonales.cedulaIdentidad.trim() || formData.cedula.trim(),
        fotoCedulaUrl: fotoCedUrl ?? legal.datosPersonales.fotoCedulaUrl,
        fotoUrl: fotoPerUrl ?? legal.datosPersonales.fotoUrl,
      },
      pesoMedidas: {
        ...legal.pesoMedidas,
        tallaCamisa: legal.pesoMedidas.tallaCamisa || formData.talla_camisa,
        medidaBotas: legal.pesoMedidas.medidaBotas || String(formData.talla_botas),
      },
    };

    const nombre = nombreCompletoDesde(merged).trim();
    const t = (s: string) => s.trim();

    const payload: Record<string, unknown> = {
      hoja_vida_obrero: merged,
      nombre_completo: nombre || 'Candidato',
      nombres: nombre.trim() || 'Candidato',
      cedula: t(merged.datosPersonales.cedulaIdentidad),
      documento: t(merged.datosPersonales.cedulaIdentidad),
      telefono: t(merged.datosPersonales.celular) || null,
      celular: celularParaInserto(t(merged.datosPersonales.celular)),
      email: t(merged.datosPersonales.correoElectronico) || null,
      fecha_nacimiento: t(merged.datosPersonales.fechaNacimiento) || null,
      direccion_habitacion: t(merged.datosPersonales.direccionDomicilio) || null,
      ciudad_estado: t(merged.datosPersonales.lugarNacimiento) || null,
      grupo_sanguineo: t(merged.antecedentesMedicos.tipoSangre) || null,
      alergias_notas: t(merged.antecedentesMedicos.enfermedadesPadecidas) || null,
      talla_camisa: merged.pesoMedidas.tallaCamisa || formData.talla_camisa,
      talla_botas: merged.pesoMedidas.medidaBotas || String(formData.talla_botas),
      rol_buscado: t(merged.contratacion.cargoUOficio) || undefined,
      cargo: t(merged.contratacion.cargoUOficio) || 'Por definir',
      cedula_foto_url: merged.datosPersonales.fotoCedulaUrl || undefined,
      foto_perfil_url: merged.datosPersonales.fotoUrl || undefined,
      estado_proceso: 'cv_completado',
      updated_at: new Date().toISOString(),
    };

    let { data, error: upErr } = await supabase
      .from('ci_empleados')
      .update(payload as never)
      .eq('token_registro', params.token)
      .select('id')
      .limit(1);

    if ((!data || data.length === 0) && !upErr) {
      const retry = await supabase
        .from('ci_empleados')
        .update(payload as never)
        .eq('token', params.token)
        .select('id')
        .limit(1);
      data = retry.data;
      upErr = retry.error;
    }

    if (upErr) {
      setIsSubmitting(false);
      setSubmitPhase('idle');
      setError(upErr.message);
      return;
    }
    if (!data || data.length === 0) {
      setIsSubmitting(false);
      setSubmitPhase('idle');
      setError('Token inválido o no encontrado.');
      return;
    }

    setSubmitPhase('pdf');
    try {
      await fetch(apiUrl('/api/talento/hoja-legal/generar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token, variante: 'hoja_vida' }),
      });
    } catch {
      /* el PDF on-demand por token sigue disponible */
    }

    void fetch(apiUrl('/api/expediente/marcar-token-usado'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token }),
    }).catch(() => undefined);

    setIsSubmitting(false);
    setSubmitPhase('idle');
    setLegal(merged);
    setStep(4);
  }

  if (tokenValidando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-6 text-center text-sm text-zinc-400">
        Validando enlace…
      </div>
    );
  }

  if (tokenInvalido) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-6 text-center">
        <p className="text-lg font-bold text-amber-200">Enlace no disponible</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">{tokenInvalido}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-root-bg flex flex-col font-sans pb-28 text-white">
      <header className="glass sticky top-0 z-50 px-6 py-5 border-b border-white/5 backdrop-blur-xl">
        <h1 className="text-xl font-bold tracking-tight text-white uppercase">
          {(planillaPatrono?.entidadNombre ?? '').trim() || 'Casa Inteligente'}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[var(--nexus-cyan)]"
              initial={{ width: 0 }}
              animate={{ width: `${(step / TOTAL_PASOS) * 100}%` }}
              transition={{ duration: 0.5, ease: "circOut" }}
            />
          </div>
          <p className="text-xs text-[var(--nexus-text-muted)] font-mono uppercase tracking-wider">
            Paso {Math.min(step, TOTAL_PASOS)} / {TOTAL_PASOS}
          </p>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">Identidad y fotos</h2>
                <p className="text-[var(--nexus-text-muted)]">
                  Cédula, foto tipo carnet y foto de tu cédula. Con eso se arma tu hoja de vida al enviar el formulario.
                </p>
              </div>

              <GlassCard className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-2">Cédula de identidad *</label>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    className="ios-input"
                    placeholder="Ej. V-12345678"
                    value={formData.cedula}
                    onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  />
                </div>
                <div>
                  <DocumentUpload
                    label="Foto de perfil (tipo carnet) *"
                    currentFileName={perfilFoto?.name}
                    preferCamera
                    uploadOnSelect={async (file) => {
                      const up = await uploadOnboardingPerfilPhoto(file, params.token, supabase);
                      if (up.error) throw new Error(up.error);
                      return { publicUrl: up.url ?? undefined };
                    }}
                    onUploadError={(msg) => setError(msg)}
                    onUploadSuccess={({ file, publicUrl }) => {
                      setPerfilFoto(file);
                      if (publicUrl) setPerfilFotoUrl(publicUrl);
                      setError(null);
                    }}
                  />
                  {perfilFotoUrl && !perfilFoto ? (
                    <p className="mt-1 text-[11px] text-emerald-400/90">Foto de perfil ya cargada.</p>
                  ) : null}
                </div>
                <div>
                  <DocumentUpload
                    label="Foto de cédula (frente) *"
                    currentFileName={cedulaFoto?.name}
                    preferCamera
                    uploadOnSelect={async (file) => {
                      const up = await uploadOnboardingCedulaPhoto(file, params.token, supabase);
                      if (up.error) throw new Error(up.error);
                      return { publicUrl: up.url ?? undefined };
                    }}
                    onUploadError={(msg) => setError(msg)}
                    onUploadSuccess={({ file, publicUrl }) => {
                      setCedulaFoto(file);
                      if (publicUrl) setCedulaFotoUrl(publicUrl);
                      setError(null);
                    }}
                  />
                  {cedulaFotoUrl && !cedulaFoto ? (
                    <p className="mt-1 text-[11px] text-emerald-400/90">Foto de cédula ya cargada.</p>
                  ) : null}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">Dotación</h2>
                <p className="text-[var(--nexus-text-muted)]">Tallas estimadas para tu uniforme y equipo de seguridad.</p>
              </div>
              
              <GlassCard className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-2">Camisa</label>
                  <select
                    className="ios-input ci-select-tabulador"
                    value={formData.talla_camisa}
                    onChange={(e) => setFormData({ ...formData, talla_camisa: e.target.value })}
                  >
                    <option>S</option>
                    <option>M</option>
                    <option>L</option>
                    <option>XL</option>
                    <option>XXL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-2">Botas (nº)</label>
                  <input
                    type="number"
                    min={35}
                    max={50}
                    className="ios-input"
                    value={formData.talla_botas}
                    onChange={(e) => setFormData({ ...formData, talla_botas: e.target.value })}
                  />
                </div>
              </GlassCard>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">Hoja de Vida</h2>
                <p className="text-sm text-[var(--nexus-text-muted)]">
                  Formulario legal completo (una sola vez). Al contratarte, estos datos rellenan la hoja de empleo; RRHH
                  solo completa patrono, obra y faltantes. Información confidencial.
                </p>
              </div>

              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 border-b border-white/5 bg-white/[0.02]">
                  <OnboardingHojaVidaLegalForm value={legal} onChange={setLegal} />
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarVista((v) => !v)}
                  className="w-full py-3 text-xs font-bold uppercase tracking-widest text-[var(--nexus-cyan)] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  {mostrarVista ? 'Ocultar' : 'Ver'} Resumen Visual
                </button>
              </GlassCard>

              {mostrarVista ? (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-2xl border border-white/10 overflow-hidden bg-white shadow-2xl"
                >
                  <HojaVidaObreroVista
                    hojaVidaLegal={legal}
                    className="rounded-none border-0 shadow-none"
                    planillaPatrono={planillaPatrono}
                    documentVariant="hoja_vida"
                  />
                </motion.div>
              ) : null}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 text-center py-8"
            >
              <div className="w-24 h-24 bg-[var(--nexus-green)]/20 text-[var(--nexus-green)] rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(0,255,65,0.4)]">
                ✓
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">¡Hoja de vida enviada!</h2>
              <p className="text-[var(--nexus-text-muted)] max-w-sm mx-auto">
                Ya se generó tu hoja de vida. A continuación harás la evaluación: primero el tipo de color y luego la
                prueba de admisión.
              </p>
              
              <div className="flex flex-col gap-3 max-w-sm mx-auto">
                <a
                  href={`/api/talento/hoja-vida/pdf?token=${encodeURIComponent(params.token)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ios-btn-primary !bg-white/10 !text-white !shadow-none border border-white/10 hover:!bg-white/20"
                >
                  📄 Descargar PDF
                </a>
              </div>

              <GlassCard glow className="text-left mt-8 !bg-[var(--ios-blue-light)]/20 border-[var(--ios-blue)]/30">
                <p className="text-sm text-[var(--ios-teal)] font-bold flex items-center gap-2">
                  <span>⏱️</span> Siguiente: evaluación
                </p>
                <p className="text-sm text-zinc-300 mt-2">
                  {redirectSeg != null && redirectSeg > 0
                    ? `Continuamos automáticamente en ${redirectSeg} s…`
                    : 'Abriendo la evaluación de tipo de color…'}{' '}
                  Puedes empezar ya con el botón de abajo.
                </p>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
        
        {error ? (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center"
          >
            {error}
          </motion.p>
        ) : null}
      </main>

      <div className="fixed bottom-0 left-0 w-full glass-strong border-t border-white/10 p-5 safe-bottom z-50">
        {step < 4 ? (
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={isSubmitting}
            className="ios-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? submitPhase === 'compress'
                ? 'Optimizando foto…'
                : submitPhase === 'upload'
                  ? 'Subiendo fotos…'
                  : submitPhase === 'save'
                    ? 'Guardando…'
                    : submitPhase === 'pdf'
                      ? 'Generando hoja de vida…'
                      : 'Procesando…'
              : step === 3 
                ? 'Finalizar Registro' 
                : 'Siguiente'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              window.location.href = urlSiguientePostHv(params.token);
            }}
            className="ios-btn-primary w-full !bg-[var(--nexus-green)] !shadow-[0_4px_16px_rgba(0,255,65,0.2)]"
          >
            Continuar a evaluación
          </button>
        )}
      </div>
    </div>
  );
}

export default function HojaDeVidaMovil({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
          Cargando…
        </div>
      }
    >
      <HojaDeVidaMovilInner params={params} />
    </Suspense>
  );
}
