'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import { etiquetaRolExamenUI } from '@/lib/talento/exam';
import {
  PSIQUE_DESCRIPCION,
  PSIQUE_NOMBRE,
  PSIQUE_NOMBRE_MITOLOGICO,
} from '@/lib/talento/psique/identidad';
import type { MapaEvaluacionPsique } from '@/lib/talento/psique/mapaEvaluacion';
import type {
  PruebaPsiqueSugerida,
  RolExamenPsique,
} from '@/lib/talento/psique/recomendarPruebasPsique';

type PsiqueUiState = {
  palabras_clave: string[];
  pruebas: PruebaPsiqueSugerida[];
  rol_examen_sugerido: RolExamenPsique | null;
  fuente: string;
  aviso?: string;
  evaluacion?: MapaEvaluacionPsique | null;
};

type Props = {
  /** Enlace opcional a reclutamiento completo. */
  mostrarEnlaceRrhh?: boolean;
  className?: string;
};

export default function PsiqueRecomendarClient({
  mostrarEnlaceRrhh = true,
  className = '',
}: Props) {
  const [cargo, setCargo] = useState('ayudante de albañil');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<PsiqueUiState | null>(null);

  const consultar = useCallback(async () => {
    const texto = cargo.trim();
    if (!texto) {
      toast.error('Indica un cargo o solicitud');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl('/api/talento/psique/recomendar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const j = (await res.json().catch(() => ({}))) as PsiqueUiState & {
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error([j.error, j.hint].filter(Boolean).join(' — ') || 'No se pudo consultar Psique');
        return;
      }
      setRec({
        palabras_clave: j.palabras_clave ?? [],
        pruebas: j.pruebas ?? [],
        rol_examen_sugerido: j.rol_examen_sugerido ?? null,
        fuente: j.fuente ?? '',
        aviso: j.aviso,
        evaluacion: j.evaluacion ?? null,
      });
    } catch {
      toast.error('Error de red al consultar Psique');
    } finally {
      setBusy(false);
    }
  }, [cargo]);

  return (
    <div
      className={`rounded-2xl border border-violet-500/25 bg-violet-950/20 p-5 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <BookOpen className="h-5 w-5 text-violet-300" aria-hidden />
            {PSIQUE_NOMBRE}{' '}
            <span className="text-sm font-semibold text-violet-300/80">
              ({PSIQUE_NOMBRE_MITOLOGICO})
            </span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">{PSIQUE_DESCRIPCION}</p>
        </div>
        {mostrarEnlaceRrhh ? (
          <Link
            href="/rrhh/reclutamiento"
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200"
          >
            Abrir en RRHH <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          placeholder="Cargo o solicitud…"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void consultar();
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void consultar()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          {busy ? 'Consultando…' : 'Consultar Psique'}
        </button>
      </div>

      {rec ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-xs text-zinc-500">
            Claves: {rec.palabras_clave.join(', ') || '—'}
            {rec.rol_examen_sugerido
              ? ` · Rol: ${etiquetaRolExamenUI(rec.rol_examen_sugerido)}`
              : ''}
            {rec.fuente === 'fallback' ? ' · (catálogo local)' : ''}
          </p>
          {rec.evaluacion ? (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-300/90">
                {rec.evaluacion.libro}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Banco: {rec.evaluacion.banco} · Motor:{' '}
                {rec.evaluacion.motor === 'tripode' ? 'Trípode' : 'ABC'} ·{' '}
                {rec.evaluacion.duracion_minutos} min
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-zinc-300">
                {rec.evaluacion.reglas_semaforo.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {rec.aviso ? <p className="text-xs text-amber-300/90">{rec.aviso}</p> : null}
          {rec.pruebas.length === 0 ? (
            <p className="text-zinc-500">Sin coincidencias en el catálogo.</p>
          ) : (
            <ul className="space-y-2">
              {rec.pruebas.map((p) => (
                <li
                  key={p.id_prueba}
                  className="rounded-lg border border-white/10 bg-black/25 px-3 py-2"
                >
                  <p className="font-semibold text-zinc-100">{p.nombre_prueba}</p>
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    {p.categoria}
                    {p.es_clinico ? ' · clínico' : ''}
                    {p.rol_examen_sugerido
                      ? ` · ${etiquetaRolExamenUI(p.rol_examen_sugerido)}`
                      : ''}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">{p.objetivo_evaluacion}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-zinc-600">
            Vista previa del examen:{' '}
            <Link href="/talento/examen" className="text-violet-300 underline hover:text-violet-200">
              /talento/examen
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
