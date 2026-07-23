'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
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
  codigo: string | null;
  titulo: string;
  tipo: string;
  ambito: string;
  estado: string;
  prioridad: string;
  contraparte: string | null;
  cliente_nombre: string | null;
  fecha_limite: string | null;
  updated_at: string;
};

export default function LegalCasosListClient() {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroAmbito, setFiltroAmbito] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (filtroEstado) qs.set('estado', filtroEstado);
      if (filtroAmbito) qs.set('ambito', filtroAmbito);
      if (filtroTipo) qs.set('tipo', filtroTipo);
      const res = await fetch(apiUrl(`/api/legal/casos?${qs}`), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as { casos?: Caso[]; error?: string; hint?: string };
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        setCasos([]);
        return;
      }
      setCasos(data.casos ?? []);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroAmbito, filtroTipo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Gestión de expedientes</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Casos con código único EXP-YYYY-XXX, documentos asociados y bitácora.
          </p>
        </div>
        <Link
          href="/legal/casos/nuevo"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-sm font-bold text-black"
        >
          <Plus className="h-4 w-4" />
          Nuevo expediente
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">Todos los estados</option>
          {LEGAL_ESTADOS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
        <select
          value={filtroAmbito}
          onChange={(e) => setFiltroAmbito(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">Todos los ámbitos</option>
          {LEGAL_AMBITOS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">Todas las ramas / tipos</option>
          {LEGAL_TIPOS_CASO.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
          {casos.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">
              No hay expedientes con ese filtro.
            </li>
          ) : (
            casos.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/legal/casos/${c.id}`}
                  className="block px-4 py-3 transition hover:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] font-semibold tracking-wide text-amber-300/90">
                        {c.codigo || 'SIN-CÓDIGO'}
                      </p>
                      <p className="mt-0.5 font-semibold text-zinc-100">{c.titulo}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {etiquetaDe(LEGAL_TIPOS_CASO, c.tipo)} ·{' '}
                        {etiquetaDe(LEGAL_AMBITOS, c.ambito)}
                        {c.cliente_nombre ? ` · ${c.cliente_nombre}` : ''}
                        {c.contraparte ? ` · vs ${c.contraparte}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                        {etiquetaDe(LEGAL_PRIORIDADES, c.prioridad)}
                      </span>
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
                        {etiquetaDe(LEGAL_ESTADOS, c.estado)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
