'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Package, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DistribucionDespachoPartidas, type DistribucionDespachoState } from '@/components/almacen/DistribucionDespachoPartidas';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import { createClient } from '@/lib/supabase/client';
import { loadProyectos, type ProyectoRow } from '@/lib/almacen/inventoryClasificacion';
import type { ImputacionPartidaInput } from '@/types/inventario-obra';

type StockItem = {
  material_id: string;
  nombre: string;
  unidad: string;
  cantidad_disponible: number;
};

type LineaDespacho = {
  lineId: string;
  material_id: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  maxStock: number;
  distribucion: DistribucionDespachoState;
};

function lineId(): string {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const emptyDistribucion = (): DistribucionDespachoState => ({
  imputaciones: [],
  totalImputado: 0,
  valido: false,
  error: 'Distribuya la cantidad entre partidas.',
});

export default function DespachoInventarioClient() {
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [lineas, setLineas] = useState<LineaDespacho[]>([]);
  const [materialAgregar, setMaterialAgregar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient();
        const lista = await loadProyectos(supabase);
        setProyectos(lista);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al cargar proyectos');
      }
    })();
  }, []);

  const cargarStock = useCallback(async (ubicacionId: string) => {
    if (!ubicacionId) {
      setStock([]);
      return;
    }
    setLoadingStock(true);
    try {
      const res = await fetch(
        `/api/almacen/stock?ubicacion_id=${encodeURIComponent(ubicacionId)}`,
        { cache: 'no-store' },
      );
      const data = (await res.json()) as { items?: StockItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar stock');
      setStock(data.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de stock');
      setStock([]);
    } finally {
      setLoadingStock(false);
    }
  }, []);

  useEffect(() => {
    void cargarStock(origenId);
    setLineas([]);
    setMaterialAgregar('');
  }, [origenId, cargarStock]);

  const agregarLinea = () => {
    const hit = stock.find((s) => s.material_id === materialAgregar);
    if (!hit) return;
    if (lineas.some((l) => l.material_id === hit.material_id)) {
      toast.error('Ese material ya está en la lista');
      return;
    }
    setLineas((prev) => [
      ...prev,
      {
        lineId: lineId(),
        material_id: hit.material_id,
        nombre: hit.nombre,
        unidad: hit.unidad,
        cantidad: 1,
        maxStock: hit.cantidad_disponible,
        distribucion: emptyDistribucion(),
      },
    ]);
    setMaterialAgregar('');
  };

  const quitarLinea = (id: string) => {
    setLineas((prev) => prev.filter((l) => l.lineId !== id));
  };

  const puedeGuardar =
    proyectoId &&
    origenId &&
    destinoId &&
    origenId !== destinoId &&
    lineas.length > 0 &&
    lineas.every(
      (l) =>
        l.cantidad > 0 &&
        l.cantidad <= l.maxStock &&
        l.distribucion.valido &&
        l.distribucion.imputaciones.length > 0,
    );

  const guardar = async () => {
    if (!puedeGuardar) {
      toast.error('Complete obra, ubicaciones, cantidades y reparto por partidas.');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch('/api/almacen/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origen_ubicacion_id: origenId,
          destino_ubicacion_id: destinoId,
          ci_proyecto_id: proyectoId,
          tipo_movimiento: 'salida_obra',
          observaciones,
          lineas: lineas.map((l) => ({
            material_id: l.material_id,
            cantidad: l.cantidad,
            imputaciones: l.distribucion.imputaciones as ImputacionPartidaInput[],
          })),
        }),
      });
      const data = (await res.json()) as { codigo?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el despacho');
      toast.success(`Despacho ${data.codigo ?? ''} registrado (pendiente)`);
      setLineas([]);
      setObservaciones('');
      void cargarStock(origenId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const stockDisponible = stock.filter(
    (s) => !lineas.some((l) => l.material_id === s.material_id),
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-zinc-100">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/almacen"
            className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Despacho a obra</h1>
            <p className="text-xs text-zinc-500">
              Un mismo producto puede repartirse entre varias partidas del presupuesto
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Obra y rutas</h2>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Proyecto / obra</label>
            <select
              value={proyectoId}
              onChange={(e) => {
                setProyectoId(e.target.value);
                setLineas([]);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm"
            >
              <option value="">Seleccione…</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-500">Almacén origen</label>
              <UbicacionInventarioSelect
                proyectoId={proyectoId}
                value={origenId}
                onChange={setOrigenId}
                placeholder="Desde dónde sale…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-500">Destino (obra)</label>
              <UbicacionInventarioSelect
                proyectoId={proyectoId}
                value={destinoId}
                onChange={setDestinoId}
                placeholder="Hacia obra / bodega…"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              placeholder="Transporte, responsable en obra…"
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
            <Package className="h-4 w-4" />
            Materiales
          </h2>

          {!origenId ? (
            <p className="text-xs text-zinc-500">Seleccione almacén origen para ver stock disponible.</p>
          ) : loadingStock ? (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando stock…
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                  Agregar material
                </label>
                <select
                  value={materialAgregar}
                  onChange={(e) => setMaterialAgregar(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm"
                >
                  <option value="">Material en origen…</option>
                  {stockDisponible.map((s) => (
                    <option key={s.material_id} value={s.material_id}>
                      {s.nombre} ({s.cantidad_disponible} {s.unidad})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!materialAgregar}
                onClick={agregarLinea}
                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
          )}

          {lineas.map((linea) => (
            <div
              key={linea.lineId}
              className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-100">{linea.nombre}</p>
                  <p className="text-[11px] text-zinc-500">
                    Stock origen: {linea.maxStock} {linea.unidad}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => quitarLinea(linea.lineId)}
                  className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="w-full max-w-[140px]">
                <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                  Cantidad total a despachar
                </label>
                <input
                  type="number"
                  min={0}
                  max={linea.maxStock}
                  step="any"
                  value={linea.cantidad}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setLineas((prev) =>
                      prev.map((l) =>
                        l.lineId === linea.lineId
                          ? {
                              ...l,
                              cantidad:
                                Number.isFinite(n) && n >= 0
                                  ? Math.min(n, l.maxStock)
                                  : 0,
                            }
                          : l,
                      ),
                    );
                  }}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                />
              </div>
              {proyectoId && linea.cantidad > 0 ? (
                <DistribucionDespachoPartidas
                  proyectoId={proyectoId}
                  materialId={linea.material_id}
                  productoNombre={linea.nombre}
                  cantidadLinea={linea.cantidad}
                  onChange={(dist) => {
                    setLineas((prev) =>
                      prev.map((l) =>
                        l.lineId === linea.lineId ? { ...l, distribucion: dist } : l,
                      ),
                    );
                  }}
                />
              ) : null}
            </div>
          ))}
        </section>

        <button
          type="button"
          disabled={!puedeGuardar || guardando}
          onClick={() => void guardar()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 py-3.5 text-sm font-bold text-black disabled:opacity-40"
        >
          {guardando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registrando…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Registrar despacho
            </>
          )}
        </button>
      </main>
    </div>
  );
}
