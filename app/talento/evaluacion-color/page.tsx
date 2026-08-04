'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import FormularioEvaluacionColor from '@/components/talento/FormularioEvaluacionColor';
import type { ColorPerfilObrero } from '@/lib/talento/evaluacionObrero';
import { urlSiguientePostColor } from '@/lib/talento/flujoHvEvaluacion';

const REDIRECT_ABC_SEG = 3;

function EvaluacionColorInner() {
  const searchParams = useSearchParams();
  const urlToken = (searchParams.get('token') ?? '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{ token: string; nombre: string } | null>(null);
  const [resultado, setResultado] = useState<{
    perfil_color: ColorPerfilObrero;
    puntuacion_logica: number;
    puntuacion_confiabilidad: number;
    semaforo_riesgo: string | null;
    motivo: string | null;
  } | null>(null);
  const [redirectSeg, setRedirectSeg] = useState<number | null>(null);

  useEffect(() => {
    if (!urlToken) {
      setError('Se requiere un token de invitación válido.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/talento/examen/invitacion?token=${encodeURIComponent(urlToken)}`,
        );
        const data = (await res.json()) as {
          error?: string;
          examen_token?: string;
          nombre_completo?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Invitación no válida o expirada');
          return;
        }
        setCandidate({
          token: data.examen_token || urlToken,
          nombre: data.nombre_completo || 'Candidato',
        });
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlToken]);

  useEffect(() => {
    if (!resultado || !candidate) return;
    setRedirectSeg(REDIRECT_ABC_SEG);
    const tick = window.setInterval(() => {
      setRedirectSeg((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          window.clearInterval(tick);
          window.location.href = urlSiguientePostColor(candidate.token);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [resultado, candidate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <p className="text-sm text-zinc-400">Cargando evaluación de color…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <h1 className="text-xl font-bold text-red-400">Error</h1>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
          <Link
            href="/rrhh/hojas-vida"
            className="mt-6 inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700"
          >
            Volver
          </Link>
        </div>
      </div>
    );
  }

  if (resultado && candidate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <h1 className="text-2xl font-bold">¡Evaluación registrada!</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Gracias, {candidate.nombre}. Tus respuestas han sido guardadas.
          </p>
          <p className="mt-6 text-sm text-zinc-400">
            {redirectSeg != null && redirectSeg > 0
              ? `Siguiente: prueba de admisión en ${redirectSeg} s…`
              : 'Abriendo la prueba de admisión…'}
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = urlSiguientePostColor(candidate.token);
            }}
            className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
          >
            Continuar a prueba de admisión
          </button>
        </div>
      </div>
    );
  }

  if (!candidate) return null;

  return (
    <FormularioEvaluacionColor
      token={candidate.token}
      nombre={candidate.nombre}
      onFinalizar={setResultado}
    />
  );
}

export default function EvaluacionColorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
          Cargando…
        </div>
      }
    >
      <EvaluacionColorInner />
    </Suspense>
  );
}
