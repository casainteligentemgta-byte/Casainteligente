'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import FormularioEvaluacion from '@/components/talento/FormularioEvaluacion';
import { PREGUNTAS_OBRERO } from '@/lib/talento/exam';
import Link from 'next/link';

function EvaluacionObreroPageInner() {
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidateData, setCandidateData] = useState<{
    token: string;
    rol: string;
    nombre: string;
  } | null>(null);
  const [resultado, setResultado] = useState<any>(null);

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
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setError(data.error || 'Invitación no válida o expirada');
          return;
        }

        // Verificar que el rol sea obrero o vigilante
        const rol = data.rol_examen || 'obrero';
        if (rol !== 'obrero' && rol !== 'vigilante') {
          setError('Este formulario es exclusivo para personal obrero o de vigilancia.');
          return;
        }

        setCandidateData({
          token: data.examen_token || urlToken,
          rol: rol,
          nombre: data.nombre_completo || 'Candidato',
        });
      } catch (err) {
        if (!cancelled) setError('No se pudo conectar con el servidor.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urlToken]);

  const alFinalizar = (res: any) => {
    setResultado(res);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400 text-sm">Cargando evaluación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-center">
          <h1 className="text-xl font-bold text-red-400 mb-2">Error</h1>
          <p className="text-zinc-400 text-sm mb-6">{error}</p>
          <Link href="/talento" className="inline-block bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Volver al Hub
          </Link>
        </div>
      </div>
    );
  }

  if (resultado) {
    const colorSemaforo = 
      resultado.semaforo === 'verde' ? 'text-emerald-400' :
      resultado.semaforo === 'amarillo' ? 'text-amber-400' : 'text-red-400';

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">¡Evaluación Completada!</h1>
          <p className="text-zinc-400 text-sm mb-6">Gracias, {candidateData?.nombre}. Tus respuestas han sido registradas.</p>
          
          <div className="bg-zinc-950 p-4 rounded-xl mb-6 border border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Resultado preliminar</p>
            <p className={`text-xl font-bold ${colorSemaforo}`}>
              Estado: {resultado.statusEvaluacion === 'pendiente_regularizar' ? 'Pendiente' : resultado.semaforo.toUpperCase()}
            </p>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            Puedes cerrar esta ventana. El equipo de RRHH revisará tus resultados y se pondrá en contacto contigo.
          </p>
        </div>
      </div>
    );
  }

  if (!candidateData) return null;

  return (
    <FormularioEvaluacion
      preguntas={PREGUNTAS_OBRERO}
      token={candidateData.token}
      rol={candidateData.rol}
      onFinalizar={alFinalizar}
    />
  );
}

export default function EvaluacionObreroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
          <div className="text-zinc-400 text-sm">Cargando...</div>
        </div>
      }
    >
      <EvaluacionObreroPageInner />
    </Suspense>
  );
}
