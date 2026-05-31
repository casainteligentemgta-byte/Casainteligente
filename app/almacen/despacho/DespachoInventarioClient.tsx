'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DespachoAlertasConfigPanel } from '@/components/almacen/DespachoAlertasConfigPanel';
import {
  DESPACHO_ALERTAS_DEFAULT,
  type DespachoAlertasConfig,
} from '@/lib/almacen/despachoAlertasConfig';
import Link from 'next/link';
import { ArrowLeft, Loader2, Package, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DistribucionDespachoPartidas, type DistribucionDespachoState } from '@/components/almacen/DistribucionDespachoPartidas';
import DestinoObraDespachoSelect, {
  type ModoDestinoDespacho,
} from '@/components/almacen/DestinoObraDespachoSelect';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import { createClient } from '@/lib/supabase/client';
import {
  esProyectoSmartRrhhPorNombre,
  loadCatalogoProyectosApp,
} from '@/lib/proyectos/proyectosUnificados';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';
import { useContratoAdProyecto } from '@/hooks/useContratoAdProyecto';
import ProyectoAdLogisticaBanner from '@/components/proyectos/ProyectoAdLogisticaBanner';
import type { ImputacionPartidaInput } from '@/types/inventario-obra';

type ProyectoRow = { id: string; nombre: string };

type StockItem = {
  material_id: string;
  ubicacion_id: string;
  ubicacion_nombre: string;
  nombre: string;
  unidad: string;
  categoria: string | null;
  cantidad_disponible: number;
};

type LineaDespacho = {
  lineId: string;
  material_id: string;
  origen_ubicacion_id: string;
  origen_nombre: string;
  nombre: string;
  unidad: string;
  categoria: string | null;
  maxStock: number;
  destinoId: string;
  destinoModo: ModoDestinoDespacho;
  destinoEntidadId: string;
  destinoPartidaKey: string;
  destinoEtiqueta: string;
  distribucion: DistribucionDespachoState;
};

function lineId(): string {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function stockKey(item: Pick<StockItem, 'ubicacion_id' | 'material_id'>): string {
  return `${item.ubicacion_id}:${item.material_id}`;
}

function lineaStockKey(linea: Pick<LineaDespacho, 'origen_ubicacion_id' | 'material_id'>): string {
  return `${linea.origen_ubicacion_id}:${linea.material_id}`;
}

const emptyDistribucion = (): DistribucionDespachoState => ({
  imputaciones: [],
  totalImputado: 0,
  saldo: 0,
  valido: false,
  error: 'Seleccione partidas en destino y cantidades.',
});

function DespachoCargando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-sm text-zinc-500">
      Cargando módulo de despacho…
    </div>
  );
}

export default function DespachoInventarioClient() {
  const searchParams = useSearchParams();
  const proyectoIdParam = searchParams.get('proyectoId')?.trim() || '';
  const [montado, setMontado] = useState(false);
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [loadingProyectos, setLoadingProyectos] = useState(true);
  const [proyectosError, setProyectosError] = useState<string | null>(null);
  const [proyectoId, setProyectoId] = useState('');
  const [origenId, setOrigenId] = useState('');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [lineas, setLineas] = useState<LineaDespacho[]>([]);
  const [materialAgregar, setMaterialAgregar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const { isSubmitting: guardando, runLocked } = useSyncSubmitLock();
  const {
    autorizado: logisticaAutorizada,
    loading: cargandoContratoAd,
  } = useContratoAdProyecto(proyectoId || undefined);
  const [alertasConfig, setAlertasConfig] = useState<DespachoAlertasConfig>({
    ...DESPACHO_ALERTAS_DEFAULT,
  });

  const onAlertasConfigChange = useCallback((cfg: DespachoAlertasConfig) => {
    setAlertasConfig(cfg);
  }, []);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;
    void (async () => {
      setLoadingProyectos(true);
      setProyectosError(null);
      try {
        let lista: ProyectoRow[] = [];
        let apiFallo = false;

        try {
          const res = await fetch('/api/almacen/proyectos', { cache: 'no-store' });
          const contentType = res.headers.get('content-type') ?? '';
          if (!contentType.includes('application/json')) {
            throw new Error(
              res.status >= 500
                ? 'Servidor local no disponible. Reinicie npm run dev.'
                : 'Respuesta inválida al cargar proyectos.',
            );
          }
          const data = (await res.json()) as {
            proyectos?: ProyectoRow[];
            error?: string;
          };
          if (!res.ok) throw new Error(data.error || 'No se pudieron cargar proyectos');
          lista = data.proyectos ?? [];
        } catch {
          apiFallo = true;
        }

        if (lista.length === 0) {
          const supabase = createClient();
          const fallback = await loadCatalogoProyectosApp(supabase);
          if (fallback.error && apiFallo) throw new Error(fallback.error);
          if (fallback.proyectos.length) lista = fallback.proyectos;
        }

        setProyectos(lista);
        if (proyectoIdParam && lista.some((p) => p.id === proyectoIdParam)) {
          setProyectoId(proyectoIdParam);
        }
        if (lista.length === 0) {
          setProyectosError('No hay proyectos activos en ci_proyectos.');
        } else if (apiFallo) {
          toast.info('Proyectos cargados en modo respaldo (sin API).');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al cargar proyectos';
        setProyectosError(msg);
        toast.error(msg);
      } finally {
        setLoadingProyectos(false);
      }
    })();
  }, [montado, proyectoIdParam]);

  useEffect(() => {
    if (proyectoIdParam) setProyectoId(proyectoIdParam);
  }, [proyectoIdParam]);

  const cargarStock = useCallback(async (obraId: string, filtroUbicacionId?: string) => {
    if (!obraId) {
      setStock([]);
      return;
    }
    setLoadingStock(true);
    try {
      const q = new URLSearchParams({ proyecto_id: obraId });
      if (filtroUbicacionId) q.set('ubicacion_id', filtroUbicacionId);
      const res = await fetch(`/api/almacen/stock?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as {
        items?: StockItem[];
        error?: string;
        migracionPendiente?: boolean;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar stock');
      if (data.migracionPendiente) {
        toast.warning('Inventario por ubicación no configurado (migraciones 180–181).');
      }
      setStock(data.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de stock');
      setStock([]);
    } finally {
      setLoadingStock(false);
    }
  }, []);

  useEffect(() => {
    if (!proyectoId) {
      setStock([]);
      return;
    }
    void cargarStock(proyectoId, origenId || undefined);
    setLineas([]);
    setMaterialAgregar('');
  }, [proyectoId, origenId, cargarStock]);

  const agregarLinea = () => {
    const hit = stock.find((s) => stockKey(s) === materialAgregar);
    if (!hit) return;
    if (lineas.some((l) => lineaStockKey(l) === stockKey(hit))) {
      toast.error('Ese material en ese almacén ya está en la lista');
      return;
    }
    setLineas((prev) => [
      ...prev,
      {
        lineId: lineId(),
        material_id: hit.material_id,
        origen_ubicacion_id: hit.ubicacion_id,
        origen_nombre: hit.ubicacion_nombre,
        nombre: hit.nombre,
        unidad: hit.unidad,
        categoria: hit.categoria,
        maxStock: hit.cantidad_disponible,
        destinoId: '',
        destinoModo: 'partida_lulo',
        destinoEntidadId: '',
        destinoPartidaKey: '',
        destinoEtiqueta: '',
        distribucion: emptyDistribucion(),
      },
    ]);
    setMaterialAgregar('');
  };

  const quitarLinea = (id: string) => {
    setLineas((prev) => prev.filter((l) => l.lineId !== id));
  };

  const destinoCompleto = (l: LineaDespacho): boolean => {
    if (l.destinoModo === 'partida_lulo') {
      return Boolean(l.destinoPartidaKey && l.destinoId);
    }
    if (l.destinoModo === 'otra_entidad') {
      return Boolean(l.destinoEntidadId && l.destinoId);
    }
    return Boolean(l.destinoId);
  };

  const puedeGuardar =
    logisticaAutorizada &&
    proyectoId &&
    lineas.length > 0 &&
    lineas.every((l) => {
      const mov = l.distribucion.totalImputado;
      return (
        l.origen_ubicacion_id &&
        destinoCompleto(l) &&
        l.origen_ubicacion_id !== l.destinoId &&
        mov > 0 &&
        mov <= l.maxStock &&
        l.distribucion.valido &&
        l.distribucion.imputaciones.length > 0
      );
    });

  const guardar = async () => {
    if (!logisticaAutorizada) {
      toast.error('Registre el Contrato AD del proyecto antes de despachar materiales.');
      return;
    }
    if (!puedeGuardar) {
      toast.error('Complete obra, destino, cantidades y partidas a descargar.');
      return;
    }
    await runLocked(async () => {
      try {
        const porRuta = new Map<string, LineaDespacho[]>();
        for (const l of lineas) {
          const rutaKey = `${l.origen_ubicacion_id}:${l.destinoId}:${l.destinoModo}`;
          const g = porRuta.get(rutaKey) ?? [];
          g.push(l);
          porRuta.set(rutaKey, g);
        }

        const codigos: string[] = [];
        for (const [, grupo] of Array.from(porRuta.entries())) {
          const origenUbicacionId = grupo[0]!.origen_ubicacion_id;
          const destinoUbicacionId = grupo[0]!.destinoId;
          const esSalidaObra = grupo.every((l) => l.destinoModo !== 'otra_entidad');
          const res = await fetch('/api/almacen/transferencias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origen_ubicacion_id: origenUbicacionId,
              destino_ubicacion_id: destinoUbicacionId,
              ci_proyecto_id: proyectoId,
              tipo_movimiento: esSalidaObra ? 'salida_obra' : 'transferencia',
              observaciones,
              lineas: grupo.map((l) => ({
                material_id: l.material_id,
                cantidad: l.distribucion.totalImputado,
                imputaciones: l.distribucion.imputaciones as ImputacionPartidaInput[],
              })),
            }),
          });
          const data = (await res.json()) as { codigo?: string; error?: string };
          if (!res.ok) throw new Error(data.error || 'No se pudo registrar el despacho');
          if (data.codigo) codigos.push(data.codigo);
        }

        toast.success(
          codigos.length > 1
            ? `Despachos ${codigos.join(', ')} registrados`
            : `Despacho ${codigos[0] ?? ''} registrado`,
        );
        setLineas([]);
        setObservaciones('');
        void cargarStock(proyectoId, origenId || undefined);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar');
      }
    });
  };

  const stockDisponible = stock.filter(
    (s) => !lineas.some((l) => lineaStockKey(l) === stockKey(s)),
  );

  const nombreProyecto = proyectos.find((p) => p.id === proyectoId)?.nombre ?? 'la obra';

  if (!montado) return <DespachoCargando />;

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
            <h1 className="text-lg font-bold">Salida de almacén</h1>
            <p className="text-xs text-zinc-500">
              Indique el destino de cada material o producto (partida Lulo, almacén en obra u otra
              entidad) y distribuya cantidades por partida presupuestaria.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {proyectoId && !cargandoContratoAd && !logisticaAutorizada ? (
          <ProyectoAdLogisticaBanner
            proyectoId={proyectoId}
            autorizado={logisticaAutorizada}
          />
        ) : null}
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Obra y origen</h2>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Proyecto / obra</label>
            <select
              value={proyectoId}
              disabled={loadingProyectos}
              onChange={(e) => {
                setProyectoId(e.target.value);
                setOrigenId('');
                setLineas([]);
                setAlertasConfig({ ...DESPACHO_ALERTAS_DEFAULT });
              }}
              className="w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors hover:bg-white/[0.04] focus:border-white/20 disabled:opacity-50"
            >
              <option value="" className="bg-[#0A0A0F] text-zinc-100">
                {loadingProyectos ? 'Cargando proyectos…' : 'Seleccione proyecto / obra…'}
              </option>
              {proyectos.filter((p) => esProyectoSmartRrhhPorNombre(p.nombre)).length > 0 ? (
                <optgroup label="Obras principales" className="bg-[#0A0A0F] text-zinc-100">
                  {proyectos
                    .filter((p) => esProyectoSmartRrhhPorNombre(p.nombre))
                    .map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0A0A0F] text-zinc-100">
                        {p.nombre}
                      </option>
                    ))}
                </optgroup>
              ) : null}
              {proyectos.filter((p) => !esProyectoSmartRrhhPorNombre(p.nombre)).length > 0 ? (
                <optgroup label="Otros proyectos" className="bg-[#0A0A0F] text-zinc-100">
                  {proyectos
                    .filter((p) => !esProyectoSmartRrhhPorNombre(p.nombre))
                    .map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0A0A0F] text-zinc-100">
                        {p.nombre}
                      </option>
                    ))}
                </optgroup>
              ) : null}
            </select>
            {loadingProyectos ? (
              <p className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Cargando obras…
              </p>
            ) : null}
            {proyectosError ? (
              <p className="text-[10px] font-bold text-amber-400">{proyectosError}</p>
            ) : null}
            {!loadingProyectos && !proyectosError && proyectos.length === 0 ? (
              <p className="text-[10px] font-bold text-amber-400">
                Sin proyectos en base de datos. Cree uno en Proyectos → Módulo.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">
              Filtrar almacén origen (opcional)
            </label>
            <UbicacionInventarioSelect
              proyectoId={proyectoId}
              value={origenId}
              onChange={setOrigenId}
              placeholder="Todos los almacenes de la obra…"
            />
            <p className="text-[10px] text-zinc-500">
              Vacío = materiales, combustible, insumos y EPP en todos los almacenes de {nombreProyecto}.
              El destino se elige por material, debajo.
            </p>
          </div>
          {proyectoId ? (
            <DespachoAlertasConfigPanel
              proyectoId={proyectoId}
              onConfigChange={onAlertasConfigChange}
            />
          ) : null}
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
            Materiales y productos
          </h2>

          {!proyectoId ? (
            <p className="text-xs text-zinc-500">Seleccione la obra para ver materiales almacenados.</p>
          ) : loadingStock ? (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando stock de {nombreProyecto}…
            </p>
          ) : stockDisponible.length === 0 ? (
            <p className="text-xs text-amber-400/90">
              No hay stock en los almacenes de {nombreProyecto}
              {origenId ? ' en el almacén filtrado' : ''}. Registre ingresos desde Compras → ingreso a
              almacén.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                  Agregar material o producto ({stockDisponible.length} en obra)
                </label>
                <select
                  value={materialAgregar}
                  onChange={(e) => setMaterialAgregar(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm"
                >
                  <option value="">Seleccione material / producto…</option>
                  {stockDisponible.map((s) => (
                    <option key={stockKey(s)} value={stockKey(s)}>
                      {s.categoria ? `${s.categoria}: ` : ''}
                      {s.nombre} — {s.cantidad_disponible} {s.unidad} · {s.ubicacion_nombre}
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
                  <p className="font-semibold text-zinc-100">
                    {linea.categoria ? (
                      <span className="text-[10px] font-bold uppercase text-zinc-500">
                        {linea.categoria} ·{' '}
                      </span>
                    ) : null}
                    {linea.nombre}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Origen: {linea.origen_nombre} · stock: {linea.maxStock} {linea.unidad}
                    {linea.destinoEtiqueta ? (
                      <>
                        {' '}
                        ·{' '}
                        <span className="text-sky-300/90">
                          Destino: {linea.destinoEtiqueta}
                        </span>
                      </>
                    ) : null}
                    {linea.distribucion.totalImputado > 0 ? (
                      <>
                        {' '}
                        ·{' '}
                        <span className="text-orange-300/90">
                          A salir: {linea.distribucion.totalImputado} {linea.unidad}
                        </span>
                        {linea.distribucion.totalImputado < linea.maxStock - 0.0001 ? (
                          <span className="text-zinc-500">
                            {' '}
                            (quedan {linea.maxStock - linea.distribucion.totalImputado}{' '}
                            {linea.unidad} en origen)
                          </span>
                        ) : null}
                      </>
                    ) : null}
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

              <div className="space-y-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-sky-400/90">
                  Destino de este material / producto
                </label>
                <DestinoObraDespachoSelect
                  proyectoId={proyectoId}
                  materialId={linea.material_id}
                  materialNombre={linea.nombre}
                  modo={linea.destinoModo}
                  entidadId={linea.destinoEntidadId}
                  ubicacionId={linea.destinoId}
                  partidaKey={linea.destinoPartidaKey}
                  onModoChange={(modo) => {
                    setLineas((prev) =>
                      prev.map((l) =>
                        l.lineId === linea.lineId
                          ? {
                              ...l,
                              destinoModo: modo,
                              destinoEntidadId: '',
                              destinoId: '',
                              destinoPartidaKey: '',
                              destinoEtiqueta: '',
                              distribucion: emptyDistribucion(),
                            }
                          : l,
                      ),
                    );
                  }}
                  onEntidadChange={(id) => {
                    setLineas((prev) =>
                      prev.map((l) =>
                        l.lineId === linea.lineId
                          ? {
                              ...l,
                              destinoEntidadId: id,
                              destinoId: '',
                              destinoEtiqueta: '',
                              distribucion: emptyDistribucion(),
                            }
                          : l,
                      ),
                    );
                  }}
                  onUbicacionChange={(id) => {
                    if (id && id === linea.origen_ubicacion_id) {
                      toast.error('Origen y destino no pueden ser el mismo almacén');
                      return;
                    }
                    setLineas((prev) =>
                      prev.map((l) =>
                        l.lineId === linea.lineId
                          ? { ...l, destinoId: id, distribucion: emptyDistribucion() }
                          : l,
                      ),
                    );
                  }}
                  onPartidaChange={(key) => {
                    setLineas((prev) =>
                      prev.map((l) =>
                        l.lineId === linea.lineId
                          ? { ...l, destinoPartidaKey: key, distribucion: emptyDistribucion() }
                          : l,
                      ),
                    );
                  }}
                  onDestinoEtiquetaChange={(etiqueta) => {
                    setLineas((prev) =>
                      prev.map((l) =>
                        l.lineId === linea.lineId ? { ...l, destinoEtiqueta: etiqueta } : l,
                      ),
                    );
                  }}
                />
              </div>

              {proyectoId && destinoCompleto(linea) ? (
                <DistribucionDespachoPartidas
                  proyectoId={proyectoId}
                  destinoId={linea.destinoId}
                  partidaDestinoPreferida={
                    linea.destinoPartidaKey.startsWith('pp:')
                      ? linea.destinoPartidaKey.slice(3)
                      : undefined
                  }
                  partidaLegacyDestinoPreferida={
                    linea.destinoPartidaKey.startsWith('pd:')
                      ? linea.destinoPartidaKey.slice(3)
                      : undefined
                  }
                  materialId={linea.material_id}
                  productoNombre={linea.nombre}
                  cantidadLinea={linea.maxStock}
                  alertasConfig={alertasConfig}
                  onChange={(dist) => {
                    setLineas((prev) =>
                      prev.map((l) =>
                        l.lineId === linea.lineId ? { ...l, distribucion: dist } : l,
                      ),
                    );
                  }}
                />
              ) : (
                <p className="text-xs text-amber-400/90">
                  Defina el destino del material o producto (partida Lulo, almacén en obra u otra
                  entidad) e indique cuánto sale — puede ser menos que el stock almacenado.
                </p>
              )}
            </div>
          ))}
        </section>

        <button
          type="button"
          disabled={!puedeGuardar || guardando}
          onClick={() => {
            if (guardando) return;
            void guardar();
          }}
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
