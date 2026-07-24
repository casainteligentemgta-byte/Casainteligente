'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  crearCategoriaMaterial,
  type MaterialCategoryRow,
} from '@/lib/almacen/categoriasMaterialCompra';

const NUEVA_OPCION = '__nueva_categoria__';

type Props = {
  value: string;
  onChange: (categoryId: string) => void;
  categories: MaterialCategoryRow[];
  onCategoriesChange: (categories: MaterialCategoryRow[]) => void;
  disabled?: boolean;
  labelClassName?: string;
  selectClassName?: string;
};

export default function SelectorCategoriaMaterial({
  value,
  onChange,
  categories,
  onCategoriesChange,
  disabled = false,
  labelClassName = 'text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1',
  selectClassName = 'w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all',
}: Props) {
  const [modoNueva, setModoNueva] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (next: string) => {
    if (next === NUEVA_OPCION) {
      setModoNueva(true);
      setNombreNueva('');
      setError(null);
      return;
    }
    setModoNueva(false);
    onChange(next);
  };

  const guardarNueva = async () => {
    const nombre = nombreNueva.trim();
    if (nombre.length < 2) {
      setError('Indique un nombre válido.');
      return;
    }
    setCreando(true);
    setError(null);
    try {
      const supabase = createClient();
      const creada = await crearCategoriaMaterial(supabase, nombre);
      const merged = [...categories.filter((c) => c.id !== creada.id), creada].sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      );
      onCategoriesChange(merged);
      onChange(creada.id);
      setModoNueva(false);
      setNombreNueva('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la categoría');
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className={labelClassName}>Categoría de material</label>
      {!modoNueva ? (
        <select
          value={value || ''}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={disabled || !categories.length}
          className={selectClassName}
        >
          {!value ? (
            <option value="" disabled>
              {categories.length ? 'Seleccione…' : 'Sin categorías — cree una'}
            </option>
          ) : null}
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="text-black">
              {c.name}
            </option>
          ))}
          <option value={NUEVA_OPCION} className="text-black">
            + Nueva categoría…
          </option>
        </select>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input
            type="text"
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            placeholder="Nombre de la categoría"
            disabled={creando}
            className={`min-w-0 flex-1 ${selectClassName}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void guardarNueva();
              }
            }}
          />
          <button
            type="button"
            disabled={creando}
            onClick={() => void guardarNueva()}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-3 text-[10px] font-black uppercase tracking-wide text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50"
          >
            {creando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear
          </button>
          <button
            type="button"
            disabled={creando}
            onClick={() => {
              setModoNueva(false);
              setError(null);
            }}
            className="rounded-xl border border-zinc-700 px-3 py-3 text-[10px] font-bold uppercase text-zinc-400 hover:bg-zinc-900"
          >
            Cancelar
          </button>
        </div>
      )}
      {error ? <p className="text-[10px] font-bold text-red-400">{error}</p> : null}
    </div>
  );
}
