'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  COLOR_ESTADO_PROCURA,
  etiquetaEstadoProcura,
} from '@/lib/procuras/procuraEstados';
import PanelAuditoriaProcuras from '@/components/contabilidad/PanelAuditoriaProcuras';

type TabProcura = 'pendientes' | 'aprobados' | 'comprados' | 'control_interno';

type ProcuraRow = {
  id: string;
  ticket: string;
  estado: string;
  material_txt: string;
  cantidad: number;
  unidad: string;
  monto_estimado_usd: number | null;
  solicitante_nombre: string | null;
  created_at: string;
  ci_proyectos?: { nombre: string } | { nombre: string }[] | null;
};

const ESTADOS_PENDIENTES = new Set(['borrador', 'solicitada', 'pendiente_pm']);
const ESTADOS_APROBADOS = new Set(['aprobada', 'aprobada_directa']);
const ESTADOS_COMPRADOS = new Set(['en_compra', 'recibida_parcial', 'recibida']);

function nombreProyecto(v: ProcuraRow['ci_proyectos']): string {
  if (!v) return '—';
  if (Array.isArray(v)) return v[0]?.nombre ?? '—';
  return v.nombre ?? '—';
}

function filaEnTab(estado: string, tab: TabProcura): boolean {
  if (tab === 'control_interno') return false;
  const e = estado.toLowerCase();
  if (tab === 'pendientes') return ESTADOS_PENDIENTES.has(e);
  if (tab === 'aprobados') return ESTADOS_APROBADOS.has(e);
  return ESTADOS_COMPRADOS.has(e);
}

const glassBtn = (active: boolean) =>
  `px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${
    active
      ? 'bg-[#FF9500]/20 border-[#FF9500]/40 text-[#FF9500]'
      : 'bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:text-white'
  }`;

export default function ProcurasPage() {
  const [tab, setTab] = useState<TabProcura>('pendientes');
  const [filas, setFilas] = useState<ProcuraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/compras/procuras?limit=300'), { cache: 'no-store' });
      const json = (await res.json()) as { procuras?: ProcuraRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar procuras');
      setFilas(json.procuras ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = useMemo(
    () => filas.filter((f) => filaEnTab(f.estado, tab)),
    [filas, tab],
  );

  const actualizarEstado = async (id: string, nuevoEstado: 'aprobada' | 'rechazada') => {
    setProcesandoId(id);
    try {
      const res = await fetch(apiUrl('/api/compras/procuras'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], nuevoEstado }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'No se pudo actualizar');
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-4 py-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Procuras</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Control unificado · pendientes, aprobadas y compradas
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.04] text-xs font-bold text-zinc-300"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.04]">
          {(
            [
              ['pendientes', 'Pendientes'],
              ['aprobados', 'Aprobados'],
              ['comprados', 'Comprados'],
              ['control_interno', 'Control interno'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={glassBtn(tab === id)}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'control_interno' ? (
          <PanelAuditoriaProcuras />
        ) : (
          <>
            {error ? (
              <p className="text-sm text-red-400 font-medium">{error}</p>
            ) : null}

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
              <Loader2 className="animate-spin text-[#FF9500]" size={20} />
              Cargando…
            </div>
          ) : visibles.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500">Sin procuras en esta vista.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="text-left p-3">Ticket</th>
                  <th className="text-left p-3">Material</th>
                  <th className="text-left p-3">Obra</th>
                  <th className="text-right p-3">Cant.</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-right p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => {
                  const color =
                    COLOR_ESTADO_PROCURA[f.estado as keyof typeof COLOR_ESTADO_PROCURA] ??
                    '#8E8E93';
                  const busy = procesandoId === f.id;
                  return (
                    <tr key={f.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="p-3 font-mono text-xs text-[#FF9500]">{f.ticket}</td>
                      <td className="p-3 max-w-[200px] truncate">{f.material_txt}</td>
                      <td className="p-3 text-zinc-400">{nombreProyecto(f.ci_proyectos)}</td>
                      <td className="p-3 text-right tabular-nums">
                        {f.cantidad} {f.unidad}
                      </td>
                      <td className="p-3">
                        <span
                          className="text-[10px] font-black uppercase px-2 py-1 rounded-lg"
                          style={{ background: `${color}22`, color }}
                        >
                          {etiquetaEstadoProcura(f.estado)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {tab === 'pendientes' ? (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void actualizarEstado(f.id, 'aprobada')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              Aprobar
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void actualizarEstado(f.id, 'rechazada')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-black uppercase disabled:opacity-50"
                            >
                              <X size={12} />
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <Link
                            href={`/contabilidad/compras`}
                            className="text-[10px] font-bold text-zinc-500 hover:text-[#FF9500]"
                          >
                            Ver compras
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
