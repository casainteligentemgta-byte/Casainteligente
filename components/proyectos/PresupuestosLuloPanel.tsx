'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Layers, Plus, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { PresupuestoLuloRow } from '@/lib/proyectos/presupuestosLulo';

type Props = {
  proyectoId: string;
  onChanged?: () => void;
};

type CargarResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  capitulos?: number;
  partidas?: number;
  apu?: number;
  codigo_obr?: string;
  presupuesto?: PresupuestoLuloRow;
};

export default function PresupuestosLuloPanel({ proyectoId, onChanged }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PresupuestoLuloRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [mdbFile, setMdbFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [codigoCarga, setCodigoCarga] = useState('');

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

  async function cargarMdbReemplazando() {
    if (!mdbFile) {
      toast.error('Selecciona un archivo .mdb o .accdb de LuloWin.');
      return;
    }
    const n = mdbFile.name.toLowerCase();
    if (!n.endsWith('.mdb') && !n.endsWith('.accdb')) {
      toast.error('Solo archivos .mdb o .accdb.');
      return;
    }

    const principal = items.find((p) => p.es_principal);
    const msg = principal
      ? `Se borrará el presupuesto actual (${principal.codigo_obr}) y todo su capítulo/partida/APU. ¿Continuar?`
      : 'Se importará el MDB como presupuesto principal del proyecto. ¿Continuar?';
    if (!window.confirm(msg)) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', mdbFile);
      if (codigoCarga.trim()) formData.append('codigo_obr', codigoCarga.trim());

      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/presupuestos-lulo/cargar`,
        { method: 'POST', body: formData },
      );
      const data = await parseFetchJson<CargarResponse>(res);
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar el MDB');

      toast.success(data.message ?? 'Presupuesto Lulo cargado.');
      setMdbFile(null);
      setCodigoCarga('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
      onChanged?.();
      router.refresh();
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold text-amber-100">Presupuestos Lulo del proyecto</h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white"
        >
          <RefreshCw className="h-3 w-3" />
          Actualizar
        </button>
      </div>

      <div className="rounded-lg border border-sky-500/30 bg-sky-950/30 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-sky-400 shrink-0" />
          <p className="text-xs font-semibold text-sky-100">Cargar presupuesto desde LuloWin (.mdb)</p>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Al cargar un archivo nuevo se <strong className="text-zinc-200">elimina el presupuesto Lulo anterior</strong>{' '}
          (capítulos, partidas y APU) y se importa el MDB completo como presupuesto principal.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase text-zinc-500 flex-1 min-w-[200px]">
            Archivo MDB
            <input
              ref={fileInputRef}
              type="file"
              accept=".mdb,.accdb"
              onChange={(e) => setMdbFile(e.target.files?.[0] ?? null)}
              className="text-xs text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-amber-600 file:px-2 file:py-1 file:text-[10px] file:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase text-zinc-500">
            CodObr (opcional)
            <input
              value={codigoCarga}
              onChange={(e) => setCodigoCarga(e.target.value)}
              placeholder="Auto desde MDB"
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white w-28 font-mono"
            />
          </label>
          <button
            type="button"
            disabled={uploading || !mdbFile}
            onClick={() => void cargarMdbReemplazando()}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Importando…' : 'Cargar y reemplazar'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-zinc-500">Sin presupuestos Lulo vinculados. Carga un MDB arriba.</p>
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
          Para importar una ampliación sin borrar la principal, usa la CLI con otro CodObr.
        </p>
      </details>
    </section>
  );
}
