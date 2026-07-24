'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, Plus, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import ImportarPresupuestoLulo from '@/components/proyectos/ImportarPresupuestoLulo';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { PresupuestoLuloRow } from '@/lib/proyectos/presupuestosLulo';

type Props = {
  proyectoId: string;
  onChanged?: () => void;
};

export default function PresupuestosLuloPanel({ proyectoId, onChanged }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<PresupuestoLuloRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/presupuestos-lulo`,
      );
      const data = await parseFetchJson<{ presupuestos?: PresupuestoLuloRow[]; error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(data.error);
      setItems(data.presupuestos ?? []);
    } catch (e) {
      toast.error(formatErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleImportSuccess = useCallback(() => {
    void load();
    onChanged?.();
    router.refresh();
  }, [load, onChanged, router]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim() || !nombre.trim()) {
      toast.error('Código de obra y nombre son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/presupuestos-lulo`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo_obr: codigo.trim(),
            nombre: nombre.trim(),
            es_principal: items.length === 0,
          }),
        },
      );
      const data = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error);
      toast.success('Presupuesto Lulo agregado.');
      setCodigo('');
      setNombre('');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const apuHref = `/proyectos/modulo/${encodeURIComponent(proyectoId)}/control-obra/apu`;

  return (
    <section className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold text-amber-100">Presupuesto Lulo del proyecto</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={apuHref}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20"
          >
            <ExternalLink className="h-3 w-3" />
            Vista APU
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500">Cargando presupuestos…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Sin presupuesto Lulo vinculado. Importa un archivo <strong className="text-zinc-300">.mdb</strong>{' '}
          de LuloWin abajo.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
            >
              <div>
                <span className="font-mono font-semibold text-amber-200">{p.codigo_obr}</span>
                {p.es_principal ? (
                  <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                    Principal
                  </span>
                ) : null}
                <p className="text-zinc-400 mt-0.5">{p.nombre}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-sky-500/25 bg-sky-950/25 p-4">
        <ImportarPresupuestoLulo
          proyectoId={proyectoId}
          onSuccess={handleImportSuccess}
          embedded
          defaultReemplazar
          showCodigoObra
        />
      </div>

      <details className="border-t border-white/10 pt-3">
        <summary className="cursor-pointer text-[10px] uppercase text-zinc-500 hover:text-zinc-300">
          Agregar obra adicional (sin borrar las demás)
        </summary>
        <form onSubmit={agregar} className="flex flex-wrap items-end gap-2 mt-3">
          <label className="flex flex-col gap-1 text-[10px] uppercase text-zinc-500">
            CodObr
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="576PDVS2"
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white w-28 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase text-zinc-500 flex-1 min-w-[160px]">
            Nombre
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ampliación"
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white w-full"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </button>
        </form>
        <p className="text-[10px] text-zinc-500 mt-2">
          Para importar una ampliación sin borrar la principal, desmarca «Reemplazar» al cargar el MDB.
        </p>
      </details>
    </section>
  );
}
