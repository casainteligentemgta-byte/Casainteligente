'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckSquare,
  Loader2,
  Package,
  Search,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import InventarioClasificacionFields from '@/components/almacen/InventarioClasificacionFields';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import { createClient } from '@/lib/supabase/client';
import type { InventarioClasificacionValue } from '@/lib/almacen/inventoryClasificacion';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';

type ProductoRow = {
  id: number;
  nombre: string;
  categoria: string | null;
  marca: string | null;
  modelo: string | null;
  costo: number | null;
  imagen: string | null;
};

type Props = {
  /** Si se pasa, preselecciona la obra (p. ej. desde módulo proyecto). */
  proyectoIdInicial?: string;
};

export default function MigrarProductosObraPanel({ proyectoIdInicial }: Props) {
  const [productos, setProductos] = useState<ProductoRow[]>([]);
  const [yaEnObra, setYaEnObra] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [clasificacion, setClasificacion] = useState<InventarioClasificacionValue>({
    entidad_id: null,
    proyecto_id: proyectoIdInicial ?? null,
    presupuesto_partida_id: null,
  });
  const [ubicacionId, setUbicacionId] = useState('');
  const [stockInicial, setStockInicial] = useState('');
  const { isSubmitting: migrando, runLocked } = useSyncSubmitLock();

  const supabase = useMemo(() => createClient(), []);

  const cargarProductos = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id,nombre,categoria,marca,modelo,costo,imagen')
        .order('nombre');

      if (error) throw new Error(error.message);
      setProductos((data ?? []) as ProductoRow[]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error al cargar productos');
      setProductos([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const cargarYaEnObra = useCallback(async () => {
    const pid = clasificacion.proyecto_id;
    if (!pid) {
      setYaEnObra(new Set());
      return;
    }
    const { data, error } = await supabase
      .from('global_inventory')
      .select('product_id')
      .eq('proyecto_id', pid)
      .not('product_id', 'is', null);

    if (error) {
      console.warn('[migrar-productos] existentes:', error.message);
      setYaEnObra(new Set());
      return;
    }
    setYaEnObra(
      new Set(
        (data ?? []).map((r) => Number(r.product_id)).filter((n) => Number.isFinite(n) && n > 0),
      ),
    );
  }, [clasificacion.proyecto_id, supabase]);

  useEffect(() => {
    void cargarProductos();
  }, [cargarProductos]);

  useEffect(() => {
    if (proyectoIdInicial) {
      setClasificacion((prev) => ({
        ...prev,
        proyecto_id: proyectoIdInicial,
      }));
    }
  }, [proyectoIdInicial]);

  useEffect(() => {
    void cargarYaEnObra();
    setSeleccion(new Set());
  }, [cargarYaEnObra]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.categoria ?? '').toLowerCase().includes(q) ||
        (p.marca ?? '').toLowerCase().includes(q) ||
        (p.modelo ?? '').toLowerCase().includes(q),
    );
  }, [productos, busqueda]);

  const pendientesMigrar = useMemo(
    () => filtrados.filter((p) => !yaEnObra.has(p.id)),
    [filtrados, yaEnObra],
  );

  const toggle = (id: number) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seleccionarTodosPendientes = () => {
    setSeleccion(new Set(pendientesMigrar.map((p) => p.id)));
  };

  const limpiarSeleccion = () => setSeleccion(new Set());

  const migrar = async () => {
    if (!clasificacion.proyecto_id) {
      toast.error('Seleccione la obra / proyecto destino.');
      return;
    }
    if (seleccion.size === 0) {
      toast.error('Marque al menos un producto.');
      return;
    }

    await runLocked(async () => {
      try {
        const res = await fetch('/api/almacen/migrar-productos-proyecto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: clasificacion.proyecto_id,
            product_ids: Array.from(seleccion),
            ubicacion_id: ubicacionId || null,
            stock_inicial: stockInicial.trim() ? Number(stockInicial.replace(',', '.')) : 0,
            presupuesto_partida_id: clasificacion.presupuesto_partida_id,
            omitir_existentes: true,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          creados?: number;
          omitidos?: number;
          errores?: string[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'No se pudo migrar');

        const creados = data.creados ?? 0;
        const omitidos = data.omitidos ?? 0;
        if (creados > 0) {
          toast.success(
            `${creados} producto(s) agregados al inventario de la obra${omitidos ? ` · ${omitidos} ya existían` : ''}.`,
          );
        } else if (omitidos > 0) {
          toast.info('Todos los seleccionados ya estaban en la lista de la obra.');
        }

        if (data.errores?.length) {
          toast.warning(data.errores.slice(0, 2).join(' · '));
        }

        setSeleccion(new Set());
        void cargarYaEnObra();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al migrar');
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <Link
            href="/almacen"
            className="rounded-xl border border-white/10 p-3 hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black tracking-tight">Migrar productos a obra</h1>
            <p className="text-sm text-zinc-500">
              Del catálogo comercial (<code className="text-zinc-400">products</code>) al inventario
              de la obra (<code className="text-zinc-400">global_inventory</code>)
            </p>
          </div>
        </div>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xs font-black uppercase tracking-widest text-violet-400">
            Obra destino
          </h2>
          <InventarioClasificacionFields value={clasificacion} onChange={setClasificacion} />
          {clasificacion.proyecto_id ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-[10px] font-bold uppercase text-zinc-500">
                  Almacén / ubicación (opcional)
                </span>
                <UbicacionInventarioSelect
                  proyectoId={clasificacion.proyecto_id}
                  value={ubicacionId}
                  onChange={setUbicacionId}
                  soloAlmacenes={false}
                  placeholder="Sin stock en ubicación…"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-[10px] font-bold uppercase text-zinc-500">
                  Stock inicial por ítem
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={stockInicial}
                  onChange={(e) => setStockInicial(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm font-bold"
                />
                <p className="text-[10px] text-zinc-600">
                  Si indica ubicación y cantidad &gt; 0, registra stock en{' '}
                  <code className="text-zinc-500">inventario_stock</code>.
                </p>
              </label>
            </div>
          ) : null}
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400">
              <Package className="h-4 w-4" />
              Catálogo de productos
            </h2>
            <span className="text-[10px] font-bold text-zinc-500">
              {seleccion.size} seleccionados · {yaEnObra.size} ya en obra
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, categoría, marca…"
              className="w-full rounded-xl border border-white/10 bg-black/50 py-3 pl-10 pr-4 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={seleccionarTodosPendientes}
              disabled={!pendientesMigrar.length}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase hover:bg-white/5 disabled:opacity-40"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Todos los pendientes
            </button>
            <button
              type="button"
              onClick={limpiarSeleccion}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase text-zinc-500 hover:bg-white/5"
            >
              <Square className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>

          {loadError ? <p className="text-sm text-red-400">{loadError}</p> : null}

          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando catálogo…
            </p>
          ) : (
            <ul className="max-h-[420px] space-y-1 overflow-y-auto rounded-xl border border-white/10">
              {filtrados.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-zinc-500">Sin resultados</li>
              ) : (
                filtrados.map((p) => {
                  const enObra = yaEnObra.has(p.id);
                  const marcado = seleccion.has(p.id);
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors ${
                          enObra
                            ? 'bg-zinc-900/40 opacity-60'
                            : marcado
                              ? 'bg-emerald-500/10'
                              : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={enObra}
                          checked={marcado}
                          onChange={() => toggle(p.id)}
                          className="h-5 w-5 rounded border-white/20"
                        />
                        {p.imagen ? (
                          <img
                            src={p.imagen}
                            alt=""
                            className="h-10 w-10 rounded-lg border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-zinc-900">
                            <Package className="h-4 w-4 text-zinc-600" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-zinc-100">{p.nombre}</p>
                          <p className="text-[11px] text-zinc-500">
                            {p.categoria ?? 'Sin categoría'}
                            {p.marca ? ` · ${p.marca}` : ''}
                            {p.costo != null ? ` · costo ${Number(p.costo).toFixed(2)}` : ''}
                          </p>
                        </div>
                        {enObra ? (
                          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
                            En obra
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </section>

        <button
          type="button"
          disabled={migrando || !clasificacion.proyecto_id || seleccion.size === 0}
          onClick={() => void migrar()}
          className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 text-sm font-black text-white disabled:opacity-40"
        >
          {migrando ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Migrando…
            </>
          ) : (
            <>
              <ArrowRightLeft className="h-5 w-5" />
              Migrar {seleccion.size || ''} producto(s) a la obra
            </>
          )}
        </button>
      </div>
    </div>
  );
}
