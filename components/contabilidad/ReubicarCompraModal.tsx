'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import { reubicarCompra } from '@/lib/contabilidad/reubicarCompraApi';
import { createClient } from '@/lib/supabase/client';
import {
  filtrarProyectosPorEntidad,
  type ProyectoRow,
} from '@/lib/almacen/inventoryClasificacion';
import { loadCatalogoProyectosApp } from '@/lib/proyectos/proyectosUnificados';

type Props = {
  open: boolean;
  onClose: () => void;
  /** contabilidad_compras.id o canal-{uuid} */
  compraId: string;
  titulo?: string;
  entidadIdInicial?: string | null;
  proyectoIdInicial?: string | null;
  ubicacionIdInicial?: string | null;
  onGuardado?: () => void;
};

const selectClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50';

type EntidadRow = { id: string; nombre: string };

export default function ReubicarCompraModal({
  open,
  onClose,
  compraId,
  titulo = 'Reubicar compra',
  entidadIdInicial,
  proyectoIdInicial,
  ubicacionIdInicial,
  onGuardado,
}: Props) {
  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [entidadId, setEntidadId] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEntidadId(entidadIdInicial ?? '');
    setProyectoId(proyectoIdInicial ?? '');
    setUbicacionId(ubicacionIdInicial ?? '');
    void (async () => {
      try {
        const [entRes, cat] = await Promise.all([
          fetch('/api/almacen/entidades', { cache: 'no-store' }),
          loadCatalogoProyectosApp(createClient()),
        ]);
        const entData = (await entRes.json()) as { entidades?: EntidadRow[] };
        setEntidades(entData.entidades ?? []);
        setProyectos(
          (cat.proyectos ?? []).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            entidad_id: p.entidad_id ?? null,
          })),
        );
      } catch {
        /* opcional */
      }
    })();
  }, [open, entidadIdInicial, proyectoIdInicial, ubicacionIdInicial]);

  const proyectosFiltrados = useMemo(
    () => filtrarProyectosPorEntidad(proyectos, entidadId || null),
    [proyectos, entidadId],
  );

  const guardar = async () => {
    if (!entidadId || !proyectoId) {
      toast.error('Seleccione entidad y obra');
      return;
    }
    const nombreObra = proyectos.find((p) => p.id === proyectoId)?.nombre;
    setGuardando(true);
    try {
      const r = await reubicarCompra(compraId, {
        entidad_id: entidadId,
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
              : 'Entidad, obra y almacén actualizados'),
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
          Asigne la <b className="text-zinc-400">entidad</b> y la <b className="text-zinc-400">obra</b> en
          contabilidad. El <b className="text-zinc-400">almacén</b> es opcional hasta que ingrese el material;
          si ya está en inventario y cambia almacén, el stock se traslada.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Entidad</label>
            <select
              value={entidadId}
              onChange={(e) => {
                setEntidadId(e.target.value);
                setProyectoId('');
                setUbicacionId('');
              }}
              className={selectClass}
            >
              <option value="">Seleccione entidad…</option>
              {entidades.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Obra / proyecto</label>
            <select
              value={proyectoId}
              disabled={!entidadId}
              onChange={(e) => {
                setProyectoId(e.target.value);
                setUbicacionId('');
              }}
              className={selectClass}
            >
              <option value="">
                {entidadId ? 'Seleccione obra…' : 'Primero elija entidad…'}
              </option>
              {proyectosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              Almacén de ingreso <span className="font-normal normal-case text-zinc-600">(opcional)</span>
            </label>
            <p className="mb-1.5 text-[10px] text-zinc-500">
              Vacío = contabilidad sin almacén asignado (ingreso físico pendiente).
            </p>
            <UbicacionInventarioSelect
              proyectoId={proyectoId}
              value={ubicacionId}
              onChange={setUbicacionId}
              disabled={!proyectoId}
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
            disabled={guardando || !entidadId || !proyectoId}
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
