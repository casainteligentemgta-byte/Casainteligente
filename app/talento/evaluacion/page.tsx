'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import FormularioEvaluacionUnificada from '@/components/talento/FormularioEvaluacionUnificada';

function EvaluacionUnificadaInner() {
  const searchParams = useSearchParams();
  const urlToken = (searchParams.get('token') ?? '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{
    token: string;
    nombre: string;
    cargo: string;
    codigoGoE: string;
    rol: string;
  } | null>(null);
  const [listo, setListo] = useState(false);

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
          rol_examen?: string;
          examen_token?: string;
          nombre_completo?: string;
          rol_buscado?: string | null;
          cargo?: string | null;
          cargo_codigo?: string | null;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Invitación no válida o expirada');
          return;
        }
        const rol = (data.rol_examen || 'obrero').trim().toLowerCase();
        if (rol !== 'obrero' && rol !== 'vigilante') {
          setError('Esta evaluación es para personal obrero o de vigilancia.');
          return;
        }
        setCandidate({
          token: data.examen_token || urlToken,
          nombre: data.nombre_completo || 'Candidato',
          cargo: (data.rol_buscado || data.cargo || '').trim(),
          codigoGoE: (data.cargo_codigo || '').trim(),
          rol,
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Cargando evaluación…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <h1 className="text-xl font-bold text-red-400">Error</h1>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
          <Link href="/talento" className="mt-6 inline-block text-sm text-sky-400">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  if (listo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">¡Evaluación Completada!</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Gracias, {candidate?.nombre}. Tus respuestas han sido registradas.
          </p>
          <p className="mt-6 text-xs leading-relaxed text-zinc-500">
            Puedes cerrar esta ventana. El equipo de RRHH revisará tus resultados y se pondrá en
            contacto contigo.
          </p>
        </div>
      </div>
    );
  }

  if (!candidate) return null;

  return (
    <FormularioEvaluacionUnificada
      token={candidate.token}
      nombre={candidate.nombre}
      cargo={candidate.cargo}
      codigoGoE={candidate.codigoGoE}
      rolExamen={candidate.rol}
      onFinalizar={() => setListo(true)}
    />
  );
}

export default function EvaluacionUnificadaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
          Cargando…
        </div>
      }
    >
      <EvaluacionUnificadaInner />
    </Suspense>
  );
}
