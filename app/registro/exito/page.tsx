'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EvaluacionEnlaceCompartir } from '@/components/registro/EvaluacionEnlaceCompartir';

const STORAGE_PREFIX = 'registro-examen-';
const REDIRECT_SEG = 4;

type ExamenPayload = {
  examUrl: string;
  nombre?: string;
  whatsapp?: string;
  autoRedirect?: boolean;
};

function parseExamenPayload(raw: string): ExamenPayload | null {
  try {
    const j = JSON.parse(raw) as ExamenPayload;
    if (j && typeof j.examUrl === 'string' && j.examUrl.startsWith('http')) return j;
  } catch {
    if (raw.startsWith('http')) return { examUrl: raw };
  }
  return null;
}

function RegistroExitoInner() {
  const sp = useSearchParams();
  const empleadoId = (sp.get('empleadoId') ?? '').trim();
  const cedula = (sp.get('cedula') ?? '').trim();
  const [payload, setPayload] = useState<ExamenPayload | null>(null);
  const [redirectSeg, setRedirectSeg] = useState<number | null>(null);

  const storageKey = useMemo(
    () => (empleadoId ? `${STORAGE_PREFIX}${empleadoId}` : null),
    [empleadoId],
  );

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      const p = parseExamenPayload(raw);
      if (p) setPayload(p);
      window.sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!payload?.examUrl || payload.autoRedirect === false) return;
    setRedirectSeg(REDIRECT_SEG);
    const tick = window.setInterval(() => {
      setRedirectSeg((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          window.clearInterval(tick);
          window.location.href = payload.examUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [payload]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-4 py-16 text-center">
      <div className="max-w-md rounded-2xl border border-[#FF9500]/30 bg-gradient-to-b from-[#FF9500]/10 to-transparent p-8 shadow-xl shadow-black/50">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#FFD60A]/90">Casa Inteligente</p>
        <h1 className="mt-3 text-2xl font-bold text-white">¡Hoja de vida enviada!</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Tus datos ya están en el expediente. Siguiente paso: evaluación (tipo de color y prueba de admisión).
        </p>
        {empleadoId && cedula ? (
          <a
            href={`/api/registro/planilla-empleo-pdf?empleadoId=${encodeURIComponent(empleadoId)}&cedula=${encodeURIComponent(cedula)}&tipo=hoja_vida`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#FFD60A] hover:bg-white/10"
          >
            Descargar hoja de vida (PDF)
          </a>
        ) : null}
        {payload?.examUrl ? (
          <>
            <p className="mt-6 text-sm text-zinc-300">
              {redirectSeg != null && redirectSeg > 0
                ? `Continuamos a la evaluación en ${redirectSeg} s…`
                : 'Abriendo la evaluación…'}
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = payload.examUrl;
              }}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Continuar a evaluación ahora
            </button>
            <EvaluacionEnlaceCompartir
              examUrl={payload.examUrl}
              nombre={payload.nombre?.trim() || (cedula ? `Cédula ${cedula}` : '')}
              whatsappDigitsOrRaw={payload.whatsapp ?? ''}
            />
          </>
        ) : (
          <p className="mt-6 text-xs text-zinc-500">Ya puedes cerrar esta ventana.</p>
        )}
      </div>
    </div>
  );
}

export default function RegistroExitoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-sm text-zinc-500">Cargando…</div>
      }
    >
      <RegistroExitoInner />
    </Suspense>
  );
}
