'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageForUpload } from '@/lib/reclutamiento/compressImageForUpload';

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

export default function HojaDeVidaMovil({ params }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'compress' | 'upload' | 'save'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cedulaFoto, setCedulaFoto] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    cedula: '',
    talla_camisa: 'M',
    talla_botas: '40',
  });

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

    const payload: Record<string, unknown> = {
      cedula: formData.cedula.trim(),
      documento: formData.cedula.trim(),
      talla_camisa: formData.talla_camisa,
      talla_botas: formData.talla_botas,
      estado_proceso: 'cv_completado',
      updated_at: new Date().toISOString(),
    };
    if (fotoUrl) payload.cedula_foto_url = fotoUrl;

    const { data, error: upErr } = await supabase
      .from('ci_empleados')
      .update(payload)
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
    setStep(3);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-24">
      <header className="bg-white px-6 py-5 border-b border-slate-200 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">CASA INTELIGENTE</h1>
        <p className="text-sm text-slate-500 font-medium">
          Registro de Talento • Paso {Math.min(step, 3)} de 3
        </p>
      </header>

      <main className="flex-1 p-6">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Verificación de Identidad</h2>
            <p className="text-slate-600">
              Ingresa tu documento y sube una foto clara de tu Cédula o RIF.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Cédula de Identidad</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-4 text-lg outline-none"
                  placeholder="Ej. V12345678 o 12345678"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Foto de Cédula (Frente)</label>
                <label className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-white hover:bg-slate-50 transition-colors block cursor-pointer">
                  <span className="text-3xl mb-2 block">📷</span>
                  <span className="text-sm font-medium text-blue-600">
                    {cedulaFoto ? `Archivo: ${cedulaFoto.name}` : 'Toca para tomar foto'}
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
            <h2 className="text-2xl font-bold text-slate-800">Dotación y Uniforme</h2>
            <p className="text-slate-600">Necesitamos tus tallas para preparar tu equipo.</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Camisa</label>
                <select
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-4 text-lg"
                  value={formData.talla_camisa}
                  onChange={(e) => setFormData({ ...formData, talla_camisa: e.target.value })}
                >
                  <option>S</option><option>M</option><option>L</option><option>XL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Botas (Nº)</label>
                <input
                  type="number"
                  className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-4 text-lg"
                  value={formData.talla_botas}
                  onChange={(e) => setFormData({ ...formData, talla_botas: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-center mt-10">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-slate-800">¡Hoja de vida registrada!</h2>
            <p className="text-slate-600">
              Descarga tu hoja de vida en PDF si la necesitas. El siguiente paso obligatorio es la{' '}
              <strong className="text-slate-800">evaluación</strong> (prueba con preguntas). El{' '}
              <strong className="text-slate-800">contrato</strong> no se genera antes: solo lo emite RRHH después de
              revisar y aprobar tu evaluación.
            </p>
            <a
              href={`/api/talento/hoja-vida/pdf?token=${encodeURIComponent(params.token)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Descargar hoja de vida (PDF)
            </a>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mt-6 text-left">
              <p className="text-sm text-blue-800 font-medium">⏱️ En la prueba tendrás 15 minutos al iniciar el temporizador.</p>
              <p className="text-sm text-blue-800 font-medium mt-2">🤫 Hazla en un lugar tranquilo.</p>
            </div>
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        {step < 3 ? (
          <button
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
                    ? 'Guardando datos…'
                    : 'Procesando…'
              : step === 1
                ? 'Siguiente'
                : 'Finalizar Registro'}
          </button>
        ) : (
          <button
            onClick={() => {
              window.location.href = `/talento/examen?token=${encodeURIComponent(params.token)}`;
            }}
            className="w-full bg-blue-600 text-white rounded-xl py-4 text-lg font-bold"
          >
            Comenzar Prueba
          </button>
        )}
      </div>
    </div>
  );
}
