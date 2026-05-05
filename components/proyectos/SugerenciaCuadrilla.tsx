'use client';

import { HardHat, MapPin, Sparkles, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type FaseObra,
  type ObreroCandidato,
  type PerfilDisc,
  composicionIdealPorFase,
  descripcionFaseObra,
  getRecommendedCrew,
  normalizarPerfilDisc,
  scoreProximidadUbicacion,
  textoSugerenciaCuadrilla,
} from '@/lib/engine/teamComposer';

const FASES: { id: FaseObra; label: string }[] = [
  { id: 'fundaciones', label: 'Fundaciones / cimientos' },
  { id: 'estructura', label: 'Estructura' },
  { id: 'instalaciones', label: 'Instalaciones / técnica' },
  { id: 'acabados', label: 'Acabados / detalle' },
];

const CASCO: Record<
  PerfilDisc,
  { label: string; ring: string; fill: string; icon: string }
> = {
  Rojo: { label: 'Rojo (D)', ring: 'ring-red-500/50', fill: 'bg-red-500/25', icon: 'text-red-400' },
  Verde: { label: 'Verde (S)', ring: 'ring-emerald-500/50', fill: 'bg-emerald-500/20', icon: 'text-emerald-400' },
  Azul: { label: 'Azul (C)', ring: 'ring-sky-500/50', fill: 'bg-sky-500/20', icon: 'text-sky-400' },
  Amarillo: { label: 'Amarillo (I)', ring: 'ring-amber-400/50', fill: 'bg-amber-400/20', icon: 'text-amber-300' },
};

type EmpleadoRow = ObreroCandidato & {
  nombre_completo: string;
  estado?: string | null;
  estatus?: string | null;
  semaforo_riesgo?: string | null;
  semaforo?: string | null;
  rol_examen?: string | null;
};

function semaforoRiesgoVerde(row: EmpleadoRow): boolean {
  const a = (row.semaforo_riesgo ?? '').trim().toLowerCase();
  const b = (row.semaforo ?? '').trim().toLowerCase();
  if (a === 'verde') return true;
  if (a === '' && b === 'verde') return true;
  return false;
}

function estatusDisponible(row: EmpleadoRow): boolean {
  const t = String(row.estatus ?? '')
    .trim()
    .toLowerCase();
  if (t === 'disponible') return true;
  if (!t) return (row.estado ?? '').trim().toLowerCase() === 'aprobado';
  return false;
}

function CascosIdeal({ ideal }: { ideal: Record<PerfilDisc, number> }) {
  const orden: PerfilDisc[] = ['Azul', 'Verde', 'Rojo', 'Amarillo'];
  return (
    <div className="flex flex-wrap items-center gap-3">
      {orden.map((color) => {
        const n = ideal[color];
        if (n <= 0) return null;
        const st = CASCO[color];
        return (
          <div key={color} className="flex items-center gap-1.5" title={st.label}>
            <div className={`flex rounded-lg p-1 ring-1 ${st.ring} ${st.fill}`}>
              {Array.from({ length: n }).map((_, i) => (
                <HardHat key={`${color}-${i}`} className={`h-6 w-6 ${st.icon}`} aria-hidden />
              ))}
            </div>
            <span className="text-xs tabular-nums text-zinc-400">
              ×{n}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type SugerenciaCuadrillaProps = {
  nombreObra: string;
  ubicacionObra: string;
  /** UUID módulo (reservado para futuros filtros por asignación). */
  proyectoModuloId?: string;
};

export default function SugerenciaCuadrilla({ nombreObra, ubicacionObra }: SugerenciaCuadrillaProps) {
  const supabase = useMemo(() => createClient(), []);
  const [fase, setFase] = useState<FaseObra>('acabados');
  const [pool, setPool] = useState<EmpleadoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloRecomendados, setSoloRecomendados] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('ci_empleados')
        .select(
          'id,nombre_completo,perfil_color,puntuacion_logica,direccion_habitacion,ciudad_estado,semaforo_riesgo,semaforo,estado,estatus,rol_examen',
        )
        .eq('estado', 'aprobado')
        .eq('rol_examen', 'obrero');

      if (err) {
        setPool([]);
        setError(err.message);
        return;
      }
      const raw = (data ?? []) as EmpleadoRow[];
      const filtrado = raw.filter((r) => semaforoRiesgoVerde(r) && estatusDisponible(r) && normalizarPerfilDisc(r.perfil_color));
      setPool(filtrado);
    } catch {
      setPool([]);
      setError('No se pudo cargar el pool de obreros.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ideal = useMemo(() => composicionIdealPorFase(fase), [fase]);
  const motor = useMemo(
    () => getRecommendedCrew(fase, pool, { obraUbicacionTexto: ubicacionObra }),
    [fase, pool, ubicacionObra],
  );
  const idsRecom = useMemo(() => new Set(motor.idsSeleccion), [motor.idsSeleccion]);

  const filas = useMemo(() => {
    const base = [...pool].sort((a, b) => {
      const pb = scoreProximidadUbicacion(ubicacionObra, b) * 1000 + Number(b.puntuacion_logica ?? 0);
      const pa = scoreProximidadUbicacion(ubicacionObra, a) * 1000 + Number(a.puntuacion_logica ?? 0);
      return pb - pa;
    });
    if (!soloRecomendados) return base;
    return base.filter((r) => idsRecom.has(r.id));
  }, [pool, soloRecomendados, idsRecom, ubicacionObra]);

  const ubicacionCorta = useMemo(() => {
    const u = (ubicacionObra ?? '').trim();
    if (u.length <= 56) return u || 'ubicación del proyecto';
    return `${u.slice(0, 53)}…`;
  }, [ubicacionObra]);

  return (
    <section
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-black/40 p-5 shadow-[0_0_40px_rgba(0,122,255,0.06)] backdrop-blur-xl"
      aria-labelledby="sugerencia-cuadrilla-titulo"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/35 bg-sky-500/10">
            <Users className="h-5 w-5 text-sky-400" aria-hidden />
          </div>
          <div>
            <h2 id="sugerencia-cuadrilla-titulo" className="text-base font-bold tracking-tight text-white">
              Configuración de equipo recomendada
            </h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              DISC + fase técnica (Lean Construction) · Prioridad residencial cercana (art. 240 LOTTT — costo de transporte)
            </p>
          </div>
        </div>
        <div className="flex w-full min-w-[200px] max-w-xs flex-col gap-1 sm:w-auto">
          <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Fase de obra</label>
          <select
            value={fase}
            onChange={(e) => {
              setFase(e.target.value as FaseObra);
              setSoloRecomendados(false);
            }}
            style={{ colorScheme: 'dark' }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40"
          >
            {FASES.map((o) => (
              <option key={o.id} value={o.id} className="bg-zinc-900">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Composición ideal (cascos)</p>
        <CascosIdeal ideal={ideal} />
        <p className="text-sm leading-relaxed text-zinc-300">{descripcionFaseObra(fase)}</p>
        <p className="rounded-xl border border-sky-500/20 bg-sky-950/25 px-3 py-2.5 text-sm text-zinc-200">
          {textoSugerenciaCuadrilla(nombreObra, fase, ubicacionCorta)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSoloRecomendados(true);
            requestAnimationFrame(() => {
              document.getElementById('tabla-pool-cuadrilla')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
          }}
          disabled={pool.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-black/30 hover:bg-[#0062CC] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          Auto-seleccionar mejores candidatos
        </button>
        {soloRecomendados ? (
          <button
            type="button"
            onClick={() => setSoloRecomendados(false)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            Ver todo el pool
          </button>
        ) : null}
      </div>

      <div id="tabla-pool-cuadrilla" className="mt-5">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <MapPin className="h-3.5 w-3.5 text-sky-400/90" aria-hidden />
          Orden por proximidad a la obra y lógica; solo obreros <span className="font-mono text-zinc-400">estatus=disponible</span> y{' '}
          <span className="font-mono text-zinc-400">semaforo_riesgo=verde</span>.
        </div>
        {loading ? <p className="text-sm text-zinc-500">Cargando candidatos…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {!loading && !error && pool.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No hay obreros aprobados con perfil DISC, semáforo de riesgo verde y estatus disponible. Aplica la migración{' '}
            <code className="text-zinc-400">087_ci_empleados_estatus_cuadrilla.sql</code> y completa evaluaciones.
          </p>
        ) : null}
        {!loading && !error && pool.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2.5">Obrero</th>
                  <th className="px-3 py-2.5">DISC</th>
                  <th className="px-3 py-2.5">Lógica</th>
                  <th className="px-3 py-2.5">Prox. obra</th>
                  <th className="px-3 py-2.5">Residencia</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => {
                  const col = normalizarPerfilDisc(r.perfil_color) ?? 'Amarillo';
                  const st = CASCO[col];
                  const prox = scoreProximidadUbicacion(ubicacionObra, r);
                  const destacado = soloRecomendados ? true : idsRecom.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-white/[0.06] ${destacado ? (soloRecomendados ? 'bg-sky-500/10' : 'bg-white/[0.04]') : ''}`}
                    >
                      <td className="px-3 py-2.5 font-medium text-zinc-100">{r.nombre_completo}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs ring-1 ${st.ring} ${st.fill} ${st.icon}`}>
                          <HardHat className="h-3.5 w-3.5" aria-hidden />
                          {col}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-zinc-300">
                        {r.puntuacion_logica != null ? `${Math.round(Number(r.puntuacion_logica))}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-emerald-300/95">
                        {(prox * 100).toFixed(0)}%
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-xs text-zinc-500" title={`${r.ciudad_estado ?? ''} ${r.direccion_habitacion ?? ''}`}>
                        {(r.ciudad_estado ?? '').trim() || '—'} · {(r.direccion_habitacion ?? '').slice(0, 40)}
                        {(r.direccion_habitacion ?? '').length > 40 ? '…' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
