'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type MaterialCampoOpcion = {
  id: string;
  name: string;
  sap_code: string | null;
  unit: string;
};

type Props = {
  onSeleccionar: (material: MaterialCampoOpcion) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Mínimo de caracteres para buscar (default 2). */
  minChars?: number;
  /** Si true, coincide solo al inicio del nombre/SKU (ej. "c" → Cemento…). */
  modoPrefijo?: boolean;
  /** Catálogo de la entidad (patrono). */
  entidadId?: string | null;
};

const inputClass =
  'w-full rounded-xl border border-white/10 bg-[#0A0A0F] px-4 py-3.5 text-base text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/20';

export default function BuscadorMaterialCampo({
  onSeleccionar,
  disabled,
  placeholder = 'Buscar material por nombre o SKU…',
  minChars = 2,
  modoPrefijo = false,
  entidadId = null,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<MaterialCampoOpcion[]>([]);

  const buscar = useCallback(
    async (term: string) => {
      const t = term.trim();
      if (t.length < minChars) {
        setResultados([]);
        return;
      }
      setLoading(true);
      try {
        const q = t.replace(/%/g, '');
        const patron = modoPrefijo ? `${q}%` : `%${q}%`;
        let query = supabase
          .from('global_inventory')
          .select('id,name,sap_code,unit')
          .or(`name.ilike.${patron},sap_code.ilike.${patron}`)
          .order('name')
          .limit(24);
        const eid = entidadId?.trim();
        if (eid) query = query.eq('entidad_id', eid);
        const { data, error } = await query;
        if (error) throw error;
        setResultados(
          ((data ?? []) as MaterialCampoOpcion[]).map((r) => ({
            id: r.id,
            name: r.name ?? 'Material',
            sap_code: r.sap_code ?? null,
            unit: r.unit ?? 'UND',
          })),
        );
      } catch {
        setResultados([]);
      } finally {
        setLoading(false);
      }
    },
    [supabase, minChars, modoPrefijo, entidadId],
  );

  useEffect(() => {
    const id = window.setTimeout(() => void buscar(q), 280);
    return () => window.clearTimeout(id);
  }, [q, buscar]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`${inputClass} pl-11`}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#FF9500]" />
        ) : null}
      </div>

      {resultados.length > 0 ? (
        <ul className="max-h-[min(50vh,16rem)] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl">
          {resultados.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSeleccionar(m);
                  setQ('');
                  setResultados([]);
                }}
                className="flex w-full flex-col items-start gap-0.5 border-b border-white/5 px-4 py-3 text-left transition last:border-0 hover:bg-[#FF9500]/10 disabled:opacity-50"
              >
                <span className="text-sm font-bold text-zinc-100">{m.name}</span>
                <span className="text-xs text-zinc-500">
                  SKU: {m.sap_code?.trim() || '—'} · {m.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {q.trim().length >= minChars && !loading && resultados.length === 0 ? (
        <p className="text-xs text-zinc-500">Sin coincidencias en catálogo.</p>
      ) : null}
    </div>
  );
}
