'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Camera, FolderOpen, Loader2, MessageSquareText, Plus, Scale } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import { etiquetaDe, LEGAL_ESTADOS } from '@/lib/legal/casosCatalogo';

type Caso = {
  id: string;
  titulo: string;
  estado: string;
  ambito: string;
  prioridad: string;
  contraparte: string | null;
  updated_at: string;
};

export default function LegalHomeClient() {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/legal/casos'), { credentials: 'include', cache: 'no-store' });
      const data = (await res.json()) as { casos?: Caso[]; error?: string; hint?: string };
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

  const abiertos = casos.filter((c) => !['resuelto', 'archivado', 'cancelado'].includes(c.estado));
  const urgentes = casos.filter((c) => c.prioridad === 'urgente' || c.prioridad === 'alta');

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 via-[#0c1018] to-[#07090f] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-amber-200/80">
              <Scale className="h-4 w-4" />
              Resolución de casos · obras y despacho
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Panel legal</h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Gestiona conflictos de obra, asuntos de despacho y casos externos. El foco es la
              resolución, no solo emitir documentos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/legal/inspecciones"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100"
            >
              <Camera className="h-4 w-4" />
              IurisVigía
            </Link>
            <Link
              href="/legal/asesor"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200"
            >
              <MessageSquareText className="h-4 w-4" />
              Asesor
            </Link>
            <Link
              href="/legal/casos/nuevo"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black shadow-lg shadow-amber-900/30"
            >
              <Plus className="h-4 w-4" />
              Nuevo caso
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Abiertos</p>
            <p className="mt-1 text-2xl font-bold text-white">{loading ? '—' : abiertos.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Prioridad alta</p>
            <p className="mt-1 text-2xl font-bold text-amber-200">{loading ? '—' : urgentes.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-zinc-200">{loading ? '—' : casos.length}</p>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <FolderOpen className="h-4 w-4 text-amber-400" />
            Casos recientes
          </h3>
          <Link href="/legal/casos" className="text-xs font-semibold text-amber-400/90 hover:text-amber-300">
            Ver todos
          </Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-10 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : casos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
            Aún no hay casos. Crea el primero para obras o despacho externo.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
            {casos.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/legal/casos/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition hover:bg-white/[0.03]"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{c.titulo}</p>
                    <p className="text-xs text-zinc-500">
                      {c.ambito} · {c.contraparte || 'Sin contraparte'}
                    </p>
                  </div>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
                    {etiquetaDe(LEGAL_ESTADOS, c.estado)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
