'use client';

import { useEffect, useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import { reubicarCompra } from '@/lib/contabilidad/reubicarCompraApi';
import { createClient } from '@/lib/supabase/client';
import { loadCatalogoProyectosApp } from '@/lib/proyectos/proyectosUnificados';

type Props = {
  open: boolean;
  onClose: () => void;
  /** contabilidad_compras.id o canal-{uuid} */
  compraId: string;
  titulo?: string;
  proyectoIdInicial?: string | null;
  ubicacionIdInicial?: string | null;
  onGuardado?: () => void;
};

const selectClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50';

export default function ReubicarCompraModal({
  open,
  onClose,
  compraId,
  titulo = 'Reubicar compra',
  proyectoIdInicial,
  ubicacionIdInicial,
  onGuardado,
}: Props) {
  const [proyectos, setProyectos] = useState<{ id: string; nombre: string }[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProyectoId(proyectoIdInicial ?? '');
    setUbicacionId(ubicacionIdInicial ?? '');
    void (async () => {
      try {
        const supabase = createClient();
        const { proyectos: lista } = await loadCatalogoProyectosApp(supabase);
        setProyectos(lista);
      } catch {
        /* opcional */
      }
    })();
  }, [open, proyectoIdInicial, ubicacionIdInicial]);

  const guardar = async () => {
    if (!proyectoId || !ubicacionId) {
      toast.error('Seleccione obra y almacén');
      return;
    }
    const nombreObra = proyectos.find((p) => p.id === proyectoId)?.nombre;
    setGuardando(true);
    try {
      const r = await reubicarCompra(compraId, {
        proyecto_id: proyectoId,
        ubicacion_destino_id: ubicacionId,
        nombre_obra: nombreObra,
      });
      toast.success(
        r.message ??
          (r.stockMovido
            ? 'Compra reubicada y stock trasladado al nuevo almacén'
            : r.sinCambios
              ? 'La compra ya estaba en esa ubicación'
              : 'Obra y almacén actualizados'),
      );
      onGuardado?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al reubicar');
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141418] p-5 shadow-2xl"
        role="dialog"
        aria-labelledby="reubicar-compra-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-400" />
            <h2 id="reubicar-compra-title" className="text-base font-bold text-white">
              {titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
          Asigne la obra y el almacén donde queda localizado el material. Si la compra ya ingresó a
          inventario, el stock se traslada al nuevo almacén.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Obra</label>
            <select
              value={proyectoId}
              onChange={(e) => {
                setProyectoId(e.target.value);
                setUbicacionId('');
              }}
              className={selectClass}
            >
              <option value="">Seleccione obra…</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              Almacén de ingreso
            </label>
            <UbicacionInventarioSelect
              proyectoId={proyectoId}
              value={ubicacionId}
              onChange={setUbicacionId}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-zinc-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || !proyectoId || !ubicacionId}
            onClick={() => void guardar()}
            className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 py-2.5 text-sm font-bold text-black disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar ubicación
          </button>
        </div>
      </div>
    </div>
  );
}
