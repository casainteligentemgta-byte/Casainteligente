'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/lib/http/apiUrl';

type PlantillaRow = {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  version: number;
  activo: boolean;
  updated_at: string;
};

export default function BibliotecaDocumentosPage() {
  const [rows, setRows] = useState<PlantillaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/talento/documentos-plantillas'));
      const j = (await res.json().catch(() => ({}))) as { plantillas?: PlantillaRow[]; error?: string };
      if (!res.ok) {
        setRows([]);
        setError(j.error ?? `Error ${res.status}`);
        return;
      }
      setRows(Array.isArray(j.plantillas) ? j.plantillas : []);
      if (j.error) setError(j.error);
    } catch {
      setError('Error de red');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 pb-28">
      <Link href="/talento/admin/contratos" className="mb-6 inline-block text-xs text-zinc-500 hover:text-zinc-300">
        ← Contratos Talento
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-white">Biblioteca de documentos</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Plantillas legales con marcadores <code className="text-zinc-300">{'{{VARIABLE}}'}</code>. El contrato obrero se
        rellena con la hoja de empleo del postulante y los datos del expediente en{' '}
        <code className="text-zinc-300">ci_contratos_empleado_obra</code>.
      </p>

      <button
        type="button"
        disabled={loading}
        onClick={() => void cargar()}
        className="mb-4 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
      >
        {loading ? 'Cargando…' : 'Actualizar'}
      </button>

      {error ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {error}
          {error.includes('service') || error.includes('SERVICE') ? (
            <span className="mt-2 block text-xs text-amber-200/80">
              En servidor hace falta <code className="text-amber-50">SUPABASE_SERVICE_ROLE_KEY</code> para leer y
              guardar plantillas.
            </span>
          ) : null}
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/talento/admin/documentos/${encodeURIComponent(r.codigo)}`}
              className="block rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:border-[#FF9500]/40 hover:bg-white/[0.07]"
            >
              <p className="font-semibold text-white">{r.titulo}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Código: <code className="text-zinc-400">{r.codigo}</code> · v{r.version} ·{' '}
                {r.activo ? <span className="text-emerald-400">activa</span> : <span className="text-zinc-500">inactiva</span>}
              </p>
              {r.descripcion ? <p className="mt-2 text-xs text-zinc-400">{r.descripcion}</p> : null}
            </Link>
          </li>
        ))}
      </ul>

      {!loading && rows.length === 0 && !error ? (
        <p className="text-sm text-zinc-500">No hay plantillas. Ejecuta la migración 093 en Supabase.</p>
      ) : null}
    </div>
  );
}
