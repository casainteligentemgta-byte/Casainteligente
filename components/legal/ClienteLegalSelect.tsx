'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import { parseClientesApiResponse } from '@/lib/proyectos/parseClientesApiResponse';

export type ClienteLegalOpt = { id: string; label: string; rif: string };

type Props = {
  valueId: string;
  onChange: (next: { id: string; label: string }) => void;
  className?: string;
};

export default function ClienteLegalSelect({ valueId, onChange, className }: Props) {
  const [items, setItems] = useState<ClienteLegalOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiUrl('/api/proyectos/clientes')}?t=${Date.now()}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const rawText = await res.text();
        const { items: parsed, hint: apiHint } = parseClientesApiResponse(res, rawText);
        if (cancelled) return;
        setItems(
          parsed.map((x) => ({
            id: String(x.id),
            label: (x.label || 'Sin nombre').trim(),
            rif: typeof x.rif === 'string' ? x.rif : '',
          })),
        );
        setHint(apiHint);
      } catch {
        if (!cancelled) {
          setItems([]);
          setHint('No se pudieron cargar los clientes del CRM.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtrados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        c.rif.toLowerCase().includes(needle),
    );
  }, [items, q]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase text-zinc-500">
          Cliente / mandante
        </label>
        <Link
          href="/clientes"
          className="text-[11px] font-semibold text-amber-400/90 hover:text-amber-300"
        >
          Ir a Clientes
        </Link>
      </div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o RIF…"
        className={className}
        disabled={loading}
      />
      <div className="relative">
        <select
          className={className}
          value={valueId}
          disabled={loading}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              onChange({ id: '', label: '' });
              return;
            }
            const found = items.find((c) => c.id === id);
            onChange({ id, label: found?.label ?? '' });
          }}
        >
          <option value="">
            {loading ? 'Cargando clientes…' : 'Seleccionar cliente del CRM'}
          </option>
          {filtrados.map((c) => (
            <option key={c.id} value={c.id}>
              {c.rif ? `${c.label} · ${c.rif}` : c.label}
            </option>
          ))}
        </select>
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
        ) : null}
      </div>
      {!loading && items.length === 0 ? (
        <p className="text-[11px] text-amber-200/80">
          {hint || 'No hay clientes en el módulo Clientes. Crea uno en /clientes.'}
        </p>
      ) : null}
      {!loading && items.length > 0 && filtrados.length === 0 ? (
        <p className="text-[11px] text-zinc-500">Ningún cliente coincide con la búsqueda.</p>
      ) : null}
    </div>
  );
}
