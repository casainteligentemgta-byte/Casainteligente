'use client';

import { useCallback, useMemo, useState } from 'react';
import { BookOpen, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import { CARGOS_OBREROS } from '@/lib/constants/cargosObreros';
import { CARGOS_EMPLEADOS_COMUNES } from '@/lib/constants/cargosEmpleadosComunes';
import { etiquetaRolExamenUI } from '@/lib/talento/exam';
import type { MapaEvaluacionPsique } from '@/lib/talento/psique/mapaEvaluacion';
import type {
  PruebaPsiqueSugerida,
  RolExamenPsique,
} from '@/lib/talento/psique/recomendarPruebasPsique';
import type { TipoPersonalPsique } from '@/lib/talento/psique/cargoARolExamen';

export type PsiqueRecUi = {
  palabras_clave: string[];
  pruebas: PruebaPsiqueSugerida[];
  rol_examen_sugerido: RolExamenPsique | null;
  rol_examen_para_enlace: RolExamenPsique | null;
  fuente: string;
  aviso?: string;
  evaluacion?: MapaEvaluacionPsique | null;
  gemini?: boolean;
  nota_ia?: string | null;
};

type Props = {
  onRecomendacion?: (rec: PsiqueRecUi) => void;
  className?: string;
};

export default function PsiqueCargoPanel({ onRecomendacion, className = '' }: Props) {
  const [tipoPersonal, setTipoPersonal] = useState<TipoPersonalPsique>('obrero');
  const [filtro, setFiltro] = useState('');
  const [cargoId, setCargoId] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<PsiqueRecUi | null>(null);

  const opciones = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (tipoPersonal === 'obrero') {
      return CARGOS_OBREROS.filter((c) => {
        if (!q) return true;
        return (
          c.nombre.toLowerCase().includes(q) ||
          c.codigo.includes(q) ||
          String(c.nivel).includes(q)
        );
      }).map((c) => ({
        id: c.codigo,
        label: `${c.codigo} · ${c.nombre}`,
        nombre: c.nombre,
      }));
    }
    return CARGOS_EMPLEADOS_COMUNES.filter((c) => {
      if (!q) return true;
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q) ||
        c.id.includes(q)
      );
    }).map((c) => ({
      id: c.id,
      label: `${c.nombre} · ${c.area}`,
      nombre: c.nombre,
    }));
  }, [tipoPersonal, filtro]);

  const cargoNombre = useMemo(() => {
    const hit = opciones.find((o) => o.id === cargoId);
    return hit?.nombre ?? '';
  }, [opciones, cargoId]);

  const consultar = useCallback(
    async (nextCargoId: string, nextTipo: TipoPersonalPsique) => {
      const optObrero =
        nextTipo === 'obrero'
          ? CARGOS_OBREROS.find((c) => c.codigo === nextCargoId)
          : null;
      const optEmpleado =
        nextTipo === 'empleado'
          ? CARGOS_EMPLEADOS_COMUNES.find((c) => c.id === nextCargoId)
          : null;
      const nombre = optObrero?.nombre ?? optEmpleado?.nombre ?? '';
      if (!nombre) {
        toast.error('Elige un cargo de la lista');
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(apiUrl('/api/talento/psique/recomendar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cargo: nombre,
            cargo_id: nextCargoId,
            tipo_personal: nextTipo,
            usar_ia: true,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as PsiqueRecUi & {
          error?: string;
          hint?: string;
          gemini?: boolean;
          nota_ia?: string | null;
        };
        if (!res.ok) {
          toast.error([j.error, j.hint].filter(Boolean).join(' — ') || 'No se pudo consultar Psique');
          return;
        }
        const next: PsiqueRecUi = {
          palabras_clave: j.palabras_clave ?? [],
          pruebas: j.pruebas ?? [],
          rol_examen_sugerido: j.rol_examen_sugerido ?? null,
          rol_examen_para_enlace:
            j.rol_examen_para_enlace ?? j.rol_examen_sugerido ?? null,
          fuente: j.fuente ?? '',
          aviso: j.aviso,
          evaluacion: j.evaluacion ?? null,
          gemini: Boolean(j.gemini),
          nota_ia: j.nota_ia ?? null,
        };
        setRec(next);
        onRecomendacion?.(next);
        toast.success(
          `${next.pruebas.length} prueba(s) · ${
            next.rol_examen_sugerido
              ? etiquetaRolExamenUI(next.rol_examen_sugerido)
              : 'sin rol'
          }${next.gemini ? ' · IA' : ''}`,
        );
      } catch {
        toast.error('Error de red al consultar Psique');
      } finally {
        setBusy(false);
      }
    },
    [onRecomendacion],
  );

  return (
    <div className={className}>
      <h3 className="text-sm font-bold text-violet-100">
        Psique (Ψυχή) → cargo → libro de evaluación → semáforo
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        Elige si es obrero o empleado, selecciona el cargo de la lista y Psique (IA) recomienda la
        batería y el banco del examen.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ['obrero', 'Obrero (lista tabulador)'],
            ['empleado', 'Empleado (cargos comunes)'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTipoPersonal(id);
              setCargoId('');
              setFiltro('');
              setRec(null);
            }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold tracking-wide ${
              tipoPersonal === id
                ? 'border-violet-400/50 bg-violet-500/20 text-violet-100'
                : 'border-white/15 text-zinc-400 hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder={
              tipoPersonal === 'obrero'
                ? 'Buscar oficio (ej. albañil, chofer, 5.1)…'
                : 'Buscar cargo (ej. contador, dibujante)…'
            }
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
          <select
            value={cargoId}
            onChange={(e) => {
              const id = e.target.value;
              setCargoId(id);
              if (id) void consultar(id, tipoPersonal);
            }}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">
              {tipoPersonal === 'obrero'
                ? 'Selecciona oficio del tabulador…'
                : 'Selecciona cargo de empleado…'}
            </option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy || !cargoId}
          onClick={() => void consultar(cargoId, tipoPersonal)}
          className="inline-flex h-fit items-center justify-center gap-2 self-end rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {busy ? 'Consultando…' : 'Consultar Psique'}
        </button>
      </div>

      {cargoNombre ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          Cargo activo: <span className="text-zinc-300">{cargoNombre}</span>
        </p>
      ) : null}

      {rec ? (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-xs text-zinc-500">
            Claves: {rec.palabras_clave.join(', ') || '—'}
            {rec.rol_examen_sugerido
              ? ` · Banco: ${etiquetaRolExamenUI(rec.rol_examen_sugerido)}`
              : ''}
            {rec.fuente === 'fallback' ? ' · (catálogo local)' : ''}
            {rec.gemini ? ' · afinado con IA' : ''}
          </p>
          {rec.nota_ia ? (
            <p className="flex items-start gap-1.5 text-xs text-violet-200/90">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {rec.nota_ia}
            </p>
          ) : null}
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
          <p className="flex items-center gap-1 text-[11px] text-zinc-600">
            <BookOpen className="h-3.5 w-3.5" />
            El banco de preguntas debajo se actualiza con la recomendación.
          </p>
        </div>
      ) : null}
    </div>
  );
}
