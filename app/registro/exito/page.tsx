'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EvaluacionEnlaceCompartir } from '@/components/registro/EvaluacionEnlaceCompartir';

const STORAGE_PREFIX = 'registro-examen-';

type ExamenPayload = { examUrl: string; nombre?: string; whatsapp?: string };

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-4 py-16 text-center">
      <div className="max-w-md rounded-2xl border border-[#FF9500]/30 bg-gradient-to-b from-[#FF9500]/10 to-transparent p-8 shadow-xl shadow-black/50">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#FFD60A]/90">Casa Inteligente</p>
        <h1 className="mt-3 text-2xl font-bold text-white">¡Registro exitoso!</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Tu perfil está siendo evaluado por Casa Inteligente. Si tu postulación continúa en el proceso, el equipo de talento
          se pondrá en contacto contigo.
        </p>
        <p className="mt-6 text-xs text-zinc-500">Ya puedes cerrar esta ventana.</p>
        {payload?.examUrl ? (
          <EvaluacionEnlaceCompartir
            examUrl={payload.examUrl}
            nombre={payload.nombre?.trim() || (cedula ? `Cédula ${cedula}` : '')}
            whatsappDigitsOrRaw={payload.whatsapp ?? ''}
          />
        ) : null}
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
