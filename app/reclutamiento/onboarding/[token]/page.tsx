'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { compressImageForUpload } from '@/lib/reclutamiento/compressImageForUpload';
import {
  emptyHojaVidaObreroCompleta,
  hojaVidaDesdeRow,
  nombreCompletoDesde,
  type HojaVidaObreroCompleta,
} from '@/lib/talento/hojaVidaObreroCompleta';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';
import { resolvePlanillaPatronoPdf } from '@/lib/talento/resolvePlanillaPatronoPdf';

const HojaVidaObreroVista = dynamic(() => import('@/components/talento/HojaVidaObreroVista'), {
  ssr: false,
  loading: () => <p className="text-center text-sm text-slate-500 py-6">Cargando vista…</p>,
});

const OnboardingHojaVidaLegalForm = dynamic(() => import('@/components/reclutamiento/OnboardingHojaVidaLegalForm'), {
  ssr: false,
  loading: () => <p className="text-sm text-slate-500 py-4">Cargando formulario…</p>,
});

type Props = { params: { token: string } };

async function uploadCedulaPhoto(
  file: File,
  token: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `reclutamiento/onboarding/${token}/${crypto.randomUUID()}.${ext}`;
  const buckets = ['ci-proyectos-media', 'product-media', 'productos'];
  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { url: data.publicUrl, error: null };
    }
    const msg = (error.message || '').toLowerCase();
    if (!(msg.includes('bucket') && msg.includes('not found'))) {
      return { url: null, error: error.message };
    }
  }
  return { url: null, error: 'No se encontró bucket para subir foto de cédula.' };
}

const TOTAL_PASOS = 4;

function HojaDeVidaMovilInner({ params }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'compress' | 'upload' | 'save'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cedulaFoto, setCedulaFoto] = useState<File | null>(null);
  const [mostrarVista, setMostrarVista] = useState(false);
  const [formData, setFormData] = useState({
    cedula: '',
    talla_camisa: 'M',
    talla_botas: '40',
  });
  const [legal, setLegal] = useState<HojaVidaObreroCompleta>(() => emptyHojaVidaObreroCompleta());
  const [planillaPatrono, setPlanillaPatrono] = useState<PlanillaPatronoCampos | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error: err } = await supabase
        .from('ci_empleados')
        .select('*')
        .eq('token_registro', params.token)
        .maybeSingle();
      if (!alive || err || !data) return;
      const row = data as Record<string, unknown>;
      setLegal(hojaVidaDesdeRow(row));
      try {
        const campos = await resolvePlanillaPatronoPdf(supabase, row.proyecto_modulo_id as string | null | undefined);
        if (alive) setPlanillaPatrono(campos);
      } catch {
        if (alive) setPlanillaPatrono(null);
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
    let fotoUrl: string | null = null;
    if (cedulaFoto) {
      try {
        setSubmitPhase('compress');
        const blob = await compressImageForUpload(cedulaFoto);
        const fileToSend = new File([blob], 'cedula-casa-inteligente.jpg', {
          type: blob.type.startsWith('image/') ? blob.type : 'image/jpeg',
        });
        setSubmitPhase('upload');
        const up = await uploadCedulaPhoto(fileToSend, params.token, supabase);
        if (up.error) {
          setIsSubmitting(false);
          setSubmitPhase('idle');
          setError(up.error);
          return;
        }
        fotoUrl = up.url;
        setSubmitPhase('save');
      } catch (e) {
        setIsSubmitting(false);
        setSubmitPhase('idle');
        setError(e instanceof Error ? e.message : 'No se pudo preparar la imagen.');
        return;
      }
    } else {
      setSubmitPhase('save');
    }

    const merged: HojaVidaObreroCompleta = {
      ...legal,
      datosPersonales: {
        ...legal.datosPersonales,
        cedulaIdentidad: legal.datosPersonales.cedulaIdentidad.trim() || formData.cedula.trim(),
        fotoCedulaUrl: fotoUrl ?? legal.datosPersonales.fotoCedulaUrl,
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
      estado_proceso: 'cv_completado',
      updated_at: new Date().toISOString(),
    };

    const { data, error: upErr } = await supabase
      .from('ci_empleados')
      .update(payload as never)
      .eq('token_registro', params.token)
      .select('id')
      .limit(1);

    setIsSubmitting(false);
    setSubmitPhase('idle');
    if (upErr) {
      setError(upErr.message);
      return;
    }
    if (!data || data.length === 0) {
      setError('Token inválido o no encontrado.');
      return;
    }
    setLegal(merged);
    setStep(4);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-28">
      <header className="bg-white px-6 py-5 border-b border-slate-200 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">CASA INTELIGENTE</h1>
        <p className="text-sm text-slate-500 font-medium">
          Hoja de vida obrero (formato legal) · Paso {Math.min(step, TOTAL_PASOS)} de {TOTAL_PASOS}
        </p>
      </header>

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Identidad y documento</h2>
            <p className="text-slate-600">
              Ingresa tu cédula y, si puedes, una foto clara del frente de tu cédula o RIF (se adjuntará al expediente).
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Cédula de identidad *</label>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-4 text-lg outline-none"
                  placeholder="Ej. V-12345678"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Foto de cédula (frente)</label>
                <label className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-white hover:bg-slate-50 transition-colors block cursor-pointer">
                  <span className="text-3xl mb-2 block">📷</span>
                  <span className="text-sm font-medium text-blue-600">
                    {cedulaFoto ? `Archivo: ${cedulaFoto.name}` : 'Toca para tomar o elegir foto'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setCedulaFoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Dotación (resumen)</h2>
            <p className="text-slate-600">Podrás afinar tallas también en «Peso y medidas» en el siguiente paso.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Camisa</label>
                <select
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-4 text-lg"
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">Botas (nº)</label>
                <input
                  type="number"
                  min={35}
                  max={50}
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-4 text-lg"
                  value={formData.talla_botas}
                  onChange={(e) => setFormData({ ...formData, talla_botas: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">I. Identificación del trabajador</h2>
            <p className="text-sm text-slate-600">
              Formulario legal completo. Los datos se guardan en tu expediente y en el PDF oficial.
            </p>
            <OnboardingHojaVidaLegalForm value={legal} onChange={setLegal} />
            <button
              type="button"
              onClick={() => setMostrarVista((v) => !v)}
              className="text-sm font-medium text-blue-700 underline"
            >
              {mostrarVista ? 'Ocultar' : 'Ver'} resumen visual del documento
            </button>
            {mostrarVista ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <HojaVidaObreroVista
                  hojaVidaLegal={legal}
                  className="rounded-none border-0 shadow-none"
                  planillaPatrono={planillaPatrono}
                />
              </div>
            ) : null}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 text-center mt-6">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-slate-800">¡Hoja de vida registrada!</h2>
            <p className="text-slate-600 text-left text-sm">
              Descarga el PDF con el formato legal. El siguiente paso es la <strong className="text-slate-800">evaluación</strong>.
            </p>
            <a
              href={`/api/talento/hoja-vida/pdf?token=${encodeURIComponent(params.token)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Descargar hoja de vida (PDF)
            </a>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mt-4 text-left">
              <p className="text-sm text-blue-800 font-medium">⏱️ En la prueba tendrás 15 minutos al iniciar el temporizador.</p>
              <p className="text-sm text-blue-800 font-medium mt-2">🤫 Hazla en un lugar tranquilo.</p>
            </div>
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        {step < 4 ? (
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={isSubmitting}
            className="w-full bg-slate-900 text-white rounded-xl py-4 text-lg font-bold disabled:opacity-60"
          >
            {isSubmitting
              ? submitPhase === 'compress'
                ? 'Optimizando foto…'
                : submitPhase === 'upload'
                  ? 'Subiendo foto…'
                  : submitPhase === 'save'
                    ? 'Guardando…'
                    : 'Procesando…'
              : step === 1
                ? 'Siguiente'
                : step === 2
                  ? 'Siguiente'
                  : 'Finalizar registro'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              window.location.href = `/talento/examen?token=${encodeURIComponent(params.token)}`;
            }}
            className="w-full bg-blue-600 text-white rounded-xl py-4 text-lg font-bold"
          >
            Comenzar prueba
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
