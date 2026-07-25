'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckSquare,
  Loader2,
  Ruler,
  Sparkles,
  Square,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import { METRON_NOMBRE, METRON_TAGLINE } from '@/lib/metron/identidad';
import type { MetronAnalisisRow, MetronComputoRow, MetronDisciplina } from '@/types/metron';

type Props = {
  proyectoId: string;
  nombreObra?: string;
  planoArchivoIdInicial?: string | null;
  className?: string;
};

const DISCIPLINAS: Array<{ id: MetronDisciplina | 'auto'; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'arq', label: 'ARQ' },
  { id: 'est', label: 'EST' },
  { id: 'ele', label: 'ELE' },
  { id: 'san', label: 'SAN' },
  { id: 'red', label: 'RED' },
  { id: 'cctv', label: 'CCTV' },
];

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function fmtQty(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 3 }).format(n || 0);
}

export default function MetronPlanosClient({
  proyectoId,
  nombreObra = '',
  planoArchivoIdInicial = null,
  className = '',
}: Props) {
  const [disciplina, setDisciplina] = useState<MetronDisciplina | 'auto'>('auto');
  const [file, setFile] = useState<File | null>(null);
  const [planoId, setPlanoId] = useState(planoArchivoIdInicial ?? '');
  const [loading, setLoading] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [historial, setHistorial] = useState<MetronAnalisisRow[]>([]);
  const [analisis, setAnalisis] = useState<MetronAnalisisRow | null>(null);
  const [computos, setComputos] = useState<MetronComputoRow[]>([]);

  const totalEstimado = useMemo(
    () => computos.filter((c) => c.aprobado).reduce((s, c) => s + (c.monto_estimado || 0), 0),
    [computos],
  );

  const loadHistorial = useCallback(async () => {
    if (!proyectoId.trim()) return;
    try {
      const res = await fetch(
        apiUrl(`/api/metron/analisis?proyecto_id=${encodeURIComponent(proyectoId)}`),
      );
      const j = (await res.json().catch(() => ({}))) as {
        items?: MetronAnalisisRow[];
        error?: string;
      };
      if (res.ok) setHistorial(j.items ?? []);
    } catch {
      /* ignore */
    }
  }, [proyectoId]);

  useEffect(() => {
    void loadHistorial();
  }, [loadHistorial]);

  useEffect(() => {
    if (planoArchivoIdInicial) setPlanoId(planoArchivoIdInicial);
  }, [planoArchivoIdInicial]);

  const seleccionarAnalisis = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/metron/analisis/${encodeURIComponent(id)}`));
      const j = (await res.json().catch(() => ({}))) as {
        analisis?: MetronAnalisisRow;
        error?: string;
      };
      if (!res.ok || !j.analisis) {
        toast.error(j.error || 'No se pudo cargar el análisis');
        return;
      }
      setAnalisis(j.analisis);
      setComputos(j.analisis.computos ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const analizar = useCallback(async () => {
    if (!proyectoId.trim()) {
      toast.error('Falta proyecto');
      return;
    }
    if (!file && !planoId.trim()) {
      toast.error('Sube un PDF/imagen o indica un plano registrado');
      return;
    }

    setLoading(true);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.set('proyecto_id', proyectoId);
        fd.set('archivo', file);
        fd.set('disciplina', disciplina);
        if (nombreObra) fd.set('nombre_obra', nombreObra);
        if (planoId.trim()) fd.set('plano_archivo_id', planoId.trim());
        res = await fetch(apiUrl('/api/metron/analizar'), { method: 'POST', body: fd });
      } else {
        res = await fetch(apiUrl('/api/metron/analizar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: proyectoId,
            plano_archivo_id: planoId.trim(),
            disciplina,
            nombre_obra: nombreObra || undefined,
          }),
        });
      }

      const j = (await res.json().catch(() => ({}))) as {
        analisis?: MetronAnalisisRow;
        error?: string;
        total_computos?: number;
      };
      if (!res.ok || !j.analisis) {
        toast.error(j.error || 'Metron no pudo analizar el plano');
        return;
      }
      setAnalisis(j.analisis);
      setComputos(j.analisis.computos ?? []);
      toast.success(
        `Metron: ${j.total_computos ?? j.analisis.computos?.length ?? 0} ítems de cómputo`,
      );
      void loadHistorial();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [proyectoId, file, planoId, disciplina, nombreObra, loadHistorial]);

  const toggleAprobado = (id: string) => {
    setComputos((prev) =>
      prev.map((c) => (c.id === id ? { ...c, aprobado: !c.aprobado } : c)),
    );
  };

  const persistirRevision = async (silent = false): Promise<boolean> => {
    if (!analisis) return false;
    const res = await fetch(apiUrl(`/api/metron/analisis/${analisis.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'revisado',
        computos: computos.map((c) => ({ id: c.id, aprobado: c.aprobado })),
      }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      analisis?: MetronAnalisisRow;
      error?: string;
    };
    if (!res.ok) {
      toast.error(j.error || 'No se pudo guardar');
      return false;
    }
    if (j.analisis) {
      setAnalisis(j.analisis);
      setComputos(j.analisis.computos ?? computos);
    }
    if (!silent) toast.success('Revisión guardada');
    void loadHistorial();
    return true;
  };

  const guardarAprobaciones = async () => {
    if (!analisis) return;
    setLoading(true);
    try {
      await persistirRevision(false);
    } finally {
      setLoading(false);
    }
  };

  const aplicarPresupuesto = async () => {
    if (!analisis) return;
    setAplicando(true);
    try {
      const ok = await persistirRevision(true);
      if (!ok) return;
      const res = await fetch(apiUrl(`/api/metron/analisis/${analisis.id}/aplicar`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reemplazar_metron: true }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        insertadas?: number;
        mensaje?: string;
        error?: string;
        analisis?: MetronAnalisisRow;
      };
      if (!res.ok) {
        toast.error(j.error || 'No se pudo aplicar');
        return;
      }
      if (j.analisis) {
        setAnalisis(j.analisis);
        setComputos(j.analisis.computos ?? computos);
      }
      toast.success(j.mensaje || `Insertadas ${j.insertadas ?? 0} partidas`);
      void loadHistorial();
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-amber-500/25 bg-[#0A0A0F] p-5 text-white ${className}`.trim()}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10">
              <Ruler className="h-4 w-4 text-amber-400" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-bold tracking-tight text-amber-100">{METRON_NOMBRE}</h3>
              <p className="text-[11px] text-zinc-500">{METRON_TAGLINE}</p>
            </div>
          </div>
        </div>
        <Link
          href={`/proyectos/modulo/${encodeURIComponent(proyectoId)}/lulo?tab=presupuesto`}
          className="text-[11px] font-semibold text-sky-400 hover:text-sky-300"
        >
          Ver presupuesto obra →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Disciplina
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DISCIPLINAS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDisciplina(d.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  disciplina === d.id
                    ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Plano registrado (opcional)
          </label>
          <input
            value={planoId}
            onChange={(e) => setPlanoId(e.target.value)}
            placeholder="UUID del plano en control de planos"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-amber-500/40"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 cursor-pointer flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            PDF / imagen
          </span>
          <span className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
            <UploadCloud className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span className="truncate">{file ? file.name : 'Elegir archivo…'}</span>
          </span>
          <input
            type="file"
            accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => void analizar()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Analizar con Metron
        </button>
      </div>

      {historial.length > 0 ? (
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Análisis previos
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {historial.slice(0, 6).map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => void seleccionarAnalisis(h.id)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-medium ${
                    analisis?.id === h.id
                      ? 'bg-amber-500/20 text-amber-100'
                      : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                  }`}
                >
                  {(h.titulo_plano || h.disciplina).slice(0, 28)} · {h.status}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {analisis ? (
        <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                {analisis.titulo_plano || 'Análisis'}{' '}
                <span className="text-[10px] font-bold uppercase text-amber-400/90">
                  {analisis.disciplina}
                </span>
              </p>
              {analisis.escala_detectada ? (
                <p className="text-[11px] text-zinc-500">Escala: {analisis.escala_detectada}</p>
              ) : null}
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{analisis.resumen}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-zinc-500">Prepresupuesto (aprobados)</p>
              <p className="text-lg font-bold text-amber-200">{fmtMoney(totalEstimado)}</p>
              <p className="text-[10px] text-zinc-600">Status: {analisis.status}</p>
            </div>
          </div>

          {analisis.alertas?.length ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Alertas
              </p>
              <ul className="list-inside list-disc text-[11px] text-amber-100/80">
                {analisis.alertas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[640px] text-left text-[11px]">
              <thead className="bg-white/[0.04] text-zinc-500">
                <tr>
                  <th className="px-2 py-2 font-semibold">OK</th>
                  <th className="px-2 py-2 font-semibold">Código</th>
                  <th className="px-2 py-2 font-semibold">Descripción</th>
                  <th className="px-2 py-2 font-semibold">Und</th>
                  <th className="px-2 py-2 font-semibold">Cant.</th>
                  <th className="px-2 py-2 font-semibold">P.U.</th>
                  <th className="px-2 py-2 font-semibold">Monto</th>
                  <th className="px-2 py-2 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {computos.map((c) => (
                  <tr key={c.id} className="border-t border-white/5 text-zinc-300">
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => toggleAprobado(c.id)}
                        className="text-amber-400"
                        aria-label={c.aprobado ? 'Quitar del presupuesto' : 'Incluir'}
                      >
                        {c.aprobado ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4 text-zinc-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-zinc-500">
                      {c.codigo_sugerido}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-zinc-200">{c.descripcion}</div>
                      {c.supuesto ? (
                        <div className="text-[10px] text-zinc-600">{c.supuesto}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">{c.unidad}</td>
                    <td className="px-2 py-1.5">{fmtQty(c.cantidad)}</td>
                    <td className="px-2 py-1.5">{fmtMoney(c.precio_unitario_estimado)}</td>
                    <td className="px-2 py-1.5 font-semibold text-zinc-100">
                      {fmtMoney(c.monto_estimado)}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-500">{Math.round(c.confianza)}</td>
                  </tr>
                ))}
                {computos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-zinc-600">
                      Sin cómputos en este análisis.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void guardarAprobaciones()}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
            >
              Guardar revisión
            </button>
            <button
              type="button"
              disabled={aplicando || loading || analisis.status === 'aplicado'}
              onClick={() => void aplicarPresupuesto()}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {aplicando ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando…
                </span>
              ) : analisis.status === 'aplicado' ? (
                'Ya aplicado al presupuesto'
              ) : (
                'Enviar a presupuesto de obra'
              )}
            </button>
          </div>
          <p className="text-[10px] text-zinc-600">
            Los precios son indicativos. Revise cantidades y confianza antes de aplicar. Las partidas
            se guardan con origen <code className="text-zinc-500">metron</code>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
