'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type PlanillaDocTipo = 'hoja_empleo' | 'hoja_vida';

/** Evita redirecciones abiertas: solo rutas relativas del mismo sitio. */
function safeReturnPath(raw: string | null): string | null {
  const s = (raw ?? '').trim();
  if (!s.startsWith('/') || s.startsWith('//')) return null;
  if (s.includes('://') || s.toLowerCase().includes('javascript:')) return null;
  if (s.length > 2048) return null;
  return s;
}

function PlanillaIframe() {
  const router = useRouter();
  const sp = useSearchParams();
  const empleadoId = (sp.get('empleadoId') ?? '').trim();
  const cedula = (sp.get('cedula') ?? '').trim().replace(/\uFEFF/g, '');
  const tipoUrl = (sp.get('tipo') ?? '').trim().toLowerCase();
  const volverRaw = sp.get('volver') ?? sp.get('return');
  const volverTo = useMemo(() => safeReturnPath(volverRaw), [volverRaw]);
  const [docTipo, setDocTipo] = useState<PlanillaDocTipo>(() =>
    tipoUrl === 'hoja_vida' ? 'hoja_vida' : 'hoja_empleo',
  );

  const src = useMemo(() => {
    if (!empleadoId || !cedula) return null;
    const tipo = docTipo === 'hoja_vida' ? 'hoja_vida' : 'hoja_empleo';
    return `/api/registro/planilla-empleo-pdf?empleadoId=${encodeURIComponent(empleadoId)}&cedula=${encodeURIComponent(cedula)}&tipo=${encodeURIComponent(tipo)}`;
  }, [empleadoId, cedula, docTipo]);

  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(empleadoId && cedula));

  useEffect(() => {
    if (!src) return;
    setLoadError(null);
    setPdfObjectUrl(null);
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(src, { credentials: 'same-origin' });
        if (cancelled) return;
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: string; hint?: string; detail?: string } | null;
          const parts = [j?.error, j?.hint, j?.detail].filter(Boolean) as string[];
          setLoadError(parts.length ? parts.join(' — ') : `Error ${res.status}`);
          return;
        }
        const ct = res.headers.get('content-type') ?? '';
        if (!ct.includes('application/pdf')) {
          setLoadError('La respuesta no es un PDF. Revisa la consola del servidor.');
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfObjectUrl(objectUrl);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'No se pudo cargar el PDF.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const setTipo = useCallback((t: PlanillaDocTipo) => {
    setDocTipo(t);
  }, []);

  if (!empleadoId || !cedula) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-4 text-center">
        <p className="max-w-md text-sm text-zinc-400">
          Faltan parámetros en la URL. Debe incluir <span className="text-zinc-200">empleadoId</span> y{' '}
          <span className="text-zinc-200">cedula</span>, por ejemplo:{' '}
          <code className="mt-2 block break-all rounded bg-white/5 px-2 py-1 text-xs text-zinc-300">
            /registro/planilla?empleadoId=…&amp;cedula=…
          </code>
        </p>
      </div>
    );
  }

  const pdfHref = src ?? '';
  const labelActivo = docTipo === 'hoja_empleo' ? 'Hoja de empleo' : 'Hoja de vida';

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0A0A0F]">
      <div className="flex shrink-0 flex-col gap-2 border-b border-white/10 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="min-w-0 truncate text-xs font-medium text-zinc-400">
          PDF · <span className="text-zinc-200">{labelActivo}</span> · {cedula}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setTipo('hoja_vida')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                docTipo === 'hoja_vida' ? 'bg-[#FF9500]/25 text-[#FFD60A]' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Hoja de vida
            </button>
            <button
              type="button"
              onClick={() => setTipo('hoja_empleo')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                docTipo === 'hoja_empleo' ? 'bg-[#FF9500]/25 text-[#FFD60A]' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Hoja de empleo
            </button>
          </div>
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#FF9500] hover:bg-white/10"
          >
            Abrir en pestaña
          </a>
          <button
            type="button"
            onClick={() => {
              if (volverTo) {
                router.push(volverTo);
                return;
              }
              if (empleadoId && cedula) {
                router.push(
                  `/registro/exito?empleadoId=${encodeURIComponent(empleadoId)}&cedula=${encodeURIComponent(cedula)}`,
                );
                return;
              }
              router.push('/registro');
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
          >
            Volver
          </button>
        </div>
      </div>
      {docTipo === 'hoja_empleo' ? (
        <p className="shrink-0 border-b border-white/5 px-3 py-1.5 text-[10px] leading-snug text-zinc-500">
          Incluye datos de patrono, obra y contratación junto con la información del trabajador para expediente laboral.
        </p>
      ) : (
        <p className="shrink-0 border-b border-white/5 px-3 py-1.5 text-[10px] leading-snug text-zinc-500">
          Sin datos del patrono, de la obra ni del vínculo de contratación; solo identificación del trabajador y
          antecedentes personales.
        </p>
      )}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Generando PDF…</div>
      ) : null}
      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="max-w-lg text-sm text-amber-200/90">{loadError}</p>
          <p className="max-w-md text-xs text-zinc-500">
            Si acabas de registrarte, usa exactamente la misma cédula que ingresaste (con o sin prefijo V). También puedes
            abrir el PDF en otra pestaña con el enlace de arriba.
          </p>
        </div>
      ) : null}
      {pdfObjectUrl && !loadError ? (
        <iframe title={labelActivo} src={pdfObjectUrl} className="min-h-0 w-full flex-1 border-0 bg-zinc-950" />
      ) : null}
    </div>
  );
}

export default function RegistroPlanillaViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-sm text-zinc-500">Cargando…</div>
      }
    >
      <PlanillaIframe />
    </Suspense>
  );
}
