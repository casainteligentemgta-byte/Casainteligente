'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Loader2,
  Plus,
  Scale,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  etiquetaDe,
  LEGAL_AMBITOS,
  LEGAL_ESTADOS,
  LEGAL_PRIORIDADES,
  LEGAL_TIPOS_CASO,
} from '@/lib/legal/casosCatalogo';

type Caso = {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  ambito: string;
  prioridad: string;
  contraparte: string | null;
  cliente_nombre: string | null;
  resumen: string | null;
  fecha_limite: string | null;
  updated_at: string;
  created_at?: string;
};

const ESTADOS_CERRADOS = new Set(['resuelto', 'archivado', 'cancelado']);
const PRIORIDAD_ORDEN: Record<string, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function esVencido(fechaLimite: string | null | undefined): boolean {
  if (!fechaLimite) return false;
  return fechaLimite.slice(0, 10) < hoyIso();
}

function esProximo(fechaLimite: string | null | undefined, dias = 7): boolean {
  if (!fechaLimite) return false;
  const lim = fechaLimite.slice(0, 10);
  const hoy = hoyIso();
  if (lim < hoy) return false;
  const tHoy = new Date(`${hoy}T12:00:00`).getTime();
  const tLim = new Date(`${lim}T12:00:00`).getTime();
  return tLim - tHoy <= dias * 86400000;
}

function badgePrioridad(prioridad: string): string {
  if (prioridad === 'urgente') return 'border-red-500/40 bg-red-950/40 text-red-200';
  if (prioridad === 'alta') return 'border-amber-500/40 bg-amber-950/40 text-amber-100';
  if (prioridad === 'baja') return 'border-white/10 bg-white/5 text-zinc-400';
  return 'border-white/10 bg-white/5 text-zinc-300';
}

function badgeEstado(estado: string): string {
  if (estado === 'resuelto') return 'border-emerald-500/35 bg-emerald-950/35 text-emerald-200';
  if (estado === 'en_gestion') return 'border-sky-500/35 bg-sky-950/35 text-sky-100';
  if (estado === 'espera_tercero') return 'border-violet-500/35 bg-violet-950/35 text-violet-100';
  if (estado === 'audiencia') return 'border-amber-500/35 bg-amber-950/35 text-amber-100';
  if (estado === 'abierto') return 'border-white/15 bg-white/5 text-zinc-200';
  return 'border-white/10 bg-white/5 text-zinc-400';
}

export default function LegalHomeClient() {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionId, setAccionId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/legal/casos'), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        casos?: Caso[];
        error?: string;
        hint?: string;
      };
      if (res.status === 403) {
        setError('Sin acceso al Departamento Legal.');
        setCasos([]);
        return;
      }
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'Error al cargar');
        return;
      }
      setCasos(data.casos ?? []);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const stats = useMemo(() => {
    const abiertos = casos.filter((c) => !ESTADOS_CERRADOS.has(c.estado));
    const enGestion = casos.filter((c) => c.estado === 'en_gestion');
    const espera = casos.filter((c) => c.estado === 'espera_tercero');
    const audiencia = casos.filter((c) => c.estado === 'audiencia');
    const resueltos = casos.filter((c) => c.estado === 'resuelto');
    const urgentes = abiertos.filter(
      (c) => c.prioridad === 'urgente' || c.prioridad === 'alta',
    );
    const vencidos = abiertos.filter((c) => esVencido(c.fecha_limite));
    const proximos = abiertos.filter(
      (c) => !esVencido(c.fecha_limite) && esProximo(c.fecha_limite),
    );
    return {
      abiertos: abiertos.length,
      enGestion: enGestion.length,
      espera: espera.length,
      audiencia: audiencia.length,
      resueltos: resueltos.length,
      urgentes: urgentes.length,
      vencidos: vencidos.length,
      proximos: proximos.length,
      total: casos.length,
    };
  }, [casos]);

  const colaResolver = useMemo(() => {
    return casos
      .filter((c) => !ESTADOS_CERRADOS.has(c.estado))
      .slice()
      .sort((a, b) => {
        const va = esVencido(a.fecha_limite) ? 0 : esProximo(a.fecha_limite) ? 1 : 2;
        const vb = esVencido(b.fecha_limite) ? 0 : esProximo(b.fecha_limite) ? 1 : 2;
        if (va !== vb) return va - vb;
        const pa = PRIORIDAD_ORDEN[a.prioridad] ?? 9;
        const pb = PRIORIDAD_ORDEN[b.prioridad] ?? 9;
        if (pa !== pb) return pa - pb;
        return String(b.updated_at).localeCompare(String(a.updated_at));
      });
  }, [casos]);

  const recientesResueltos = useMemo(() => {
    return casos
      .filter((c) => c.estado === 'resuelto')
      .slice()
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 4);
  }, [casos]);

  async function cambiarEstado(caso: Caso, estado: string) {
    setAccionId(caso.id);
    try {
      const body: Record<string, unknown> = { estado };
      if (estado === 'resuelto') {
        body.fecha_cierre = hoyIso();
      }
      const res = await fetch(apiUrl(`/api/legal/casos/${caso.id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; caso?: Caso };
      if (!res.ok) {
        toast.error(data.error || 'No se pudo actualizar el caso');
        return;
      }
      toast.success(
        estado === 'resuelto'
          ? 'Caso marcado como resuelto'
          : estado === 'en_gestion'
            ? 'Caso en gestión'
            : 'Estado actualizado',
      );
      setCasos((prev) =>
        prev.map((c) => (c.id === caso.id ? { ...c, ...(data.caso ?? { estado }) } : c)),
      );
    } catch {
      toast.error('Error de red');
    } finally {
      setAccionId(null);
    }
  }

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 via-[#0c1018] to-[#07090f] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm text-amber-200/80">
              <Scale className="h-4 w-4" />
              Resumen · resolver casos
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Panel legal</h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Prioriza lo abierto, gestiona actuaciones y cierra casos. El resumen muestra la
              cola de trabajo lista para resolver.
            </p>
          </div>
          <Link
            href="/legal/casos/nuevo"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black shadow-lg shadow-amber-900/30"
          >
            <Plus className="h-4 w-4" />
            Nuevo caso
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi
            label="Abiertos"
            value={loading ? '—' : stats.abiertos}
            hint="Por resolver"
          />
          <Kpi
            label="En gestión"
            value={loading ? '—' : stats.enGestion}
            tone="sky"
          />
          <Kpi
            label="Espera tercero"
            value={loading ? '—' : stats.espera}
            tone="violet"
          />
          <Kpi
            label="Prioridad alta"
            value={loading ? '—' : stats.urgentes}
            tone="amber"
          />
          <Kpi
            label="Vencidos"
            value={loading ? '—' : stats.vencidos}
            tone={stats.vencidos > 0 ? 'red' : 'default'}
          />
          <Kpi
            label="Resueltos"
            value={loading ? '—' : stats.resueltos}
            tone="emerald"
            hint={`de ${loading ? '—' : stats.total}`}
          />
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {(stats.vencidos > 0 || stats.proximos > 0) && !loading ? (
        <div className="flex flex-wrap items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {stats.vencidos > 0
              ? `${stats.vencidos} caso(s) con fecha límite vencida`
              : null}
            {stats.vencidos > 0 && stats.proximos > 0 ? ' · ' : null}
            {stats.proximos > 0
              ? `${stats.proximos} con vencimiento en los próximos 7 días`
              : null}
            . Atiéndelos primero en la cola.
          </p>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Cola para resolver
          </h3>
          <Link
            href="/legal/casos"
            className="text-xs font-semibold text-amber-400/90 hover:text-amber-300"
          >
            Ver todos los casos
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : colaResolver.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400/80" />
            <p className="mt-3 text-sm font-medium text-zinc-200">
              No hay casos abiertos por resolver
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Crea un caso nuevo o revisa los resueltos recientes.
            </p>
            <Link
              href="/legal/casos/nuevo"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950"
            >
              <Plus className="h-4 w-4" />
              Nuevo caso
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {colaResolver.slice(0, 10).map((c) => {
              const vencido = esVencido(c.fecha_limite);
              const proximo = !vencido && esProximo(c.fecha_limite);
              const busy = accionId === c.id;
              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-white/10 bg-[#0c1018] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/legal/casos/${c.id}`}
                          className="font-semibold text-zinc-100 hover:text-amber-100"
                        >
                          {c.titulo}
                        </Link>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgeEstado(c.estado)}`}
                        >
                          {etiquetaDe(LEGAL_ESTADOS, c.estado)}
                        </span>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgePrioridad(c.prioridad)}`}
                        >
                          {etiquetaDe(LEGAL_PRIORIDADES, c.prioridad)}
                        </span>
                        {vencido ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-200">
                            <Clock3 className="h-3 w-3" />
                            Vencido
                          </span>
                        ) : proximo ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-100">
                            <Clock3 className="h-3 w-3" />
                            Pronto
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {etiquetaDe(LEGAL_TIPOS_CASO, c.tipo)} ·{' '}
                        {etiquetaDe(LEGAL_AMBITOS, c.ambito)}
                        {c.contraparte ? ` · ${c.contraparte}` : ''}
                        {c.cliente_nombre ? ` · ${c.cliente_nombre}` : ''}
                        {c.fecha_limite
                          ? ` · límite ${c.fecha_limite.slice(0, 10)}`
                          : ''}
                      </p>
                      {c.resumen ? (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{c.resumen}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href={`/legal/casos/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20"
                      >
                        Continuar
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      {c.estado === 'abierto' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cambiarEstado(c, 'en_gestion')}
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-500/35 bg-sky-950/30 px-2.5 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-900/40 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          En gestión
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cambiarEstado(c, 'resuelto')}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/35 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/45 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Resolver
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {recientesResueltos.length > 0 ? (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <FolderOpen className="h-4 w-4 text-emerald-400" />
            Resueltos recientes
          </h3>
          <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
            {recientesResueltos.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/legal/casos/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition hover:bg-white/[0.03]"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{c.titulo}</p>
                    <p className="text-xs text-zinc-500">
                      {c.contraparte || c.cliente_nombre || etiquetaDe(LEGAL_AMBITOS, c.ambito)}
                    </p>
                  </div>
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                    Resuelto
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'amber' | 'emerald' | 'sky' | 'violet' | 'red';
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-500/25 bg-amber-500/5'
      : tone === 'emerald'
        ? 'border-emerald-500/25 bg-emerald-950/20'
        : tone === 'sky'
          ? 'border-sky-500/25 bg-sky-950/20'
          : tone === 'violet'
            ? 'border-violet-500/25 bg-violet-950/20'
            : tone === 'red'
              ? 'border-red-500/30 bg-red-950/30'
              : 'border-white/10 bg-white/[0.03]';
  const valueClass =
    tone === 'amber'
      ? 'text-amber-100'
      : tone === 'emerald'
        ? 'text-emerald-100'
        : tone === 'sky'
          ? 'text-sky-100'
          : tone === 'violet'
            ? 'text-violet-100'
            : tone === 'red'
              ? 'text-red-200'
              : 'text-white';

  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}
