'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DespachoAlertasConfigPanel } from '@/components/almacen/DespachoAlertasConfigPanel';
import {
  DESPACHO_ALERTAS_DEFAULT,
  type DespachoAlertasConfig,
} from '@/lib/almacen/despachoAlertasConfig';
import Link from 'next/link';
import { ArrowLeft, Loader2, MapPin, Package, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DistribucionDespachoPartidas, type DistribucionDespachoState } from '@/components/almacen/DistribucionDespachoPartidas';
import DespachoDestinoDocumentoPanel, {
  type DespachoDestinoDocumentoValue,
} from '@/components/almacen/DespachoDestinoDocumentoPanel';
import type { DestinoFisicoDespacho, ImputacionDespacho } from '@/components/almacen/DestinoObraDespachoSelect';
import { FotosDespachoInput, type FotoDespachoItem } from '@/components/almacen/FotosDespachoInput';
import { ReceptorDespachoSelect, type ReceptorDespachoValue } from '@/components/almacen/ReceptorDespachoSelect';
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
  cantidadSalida: number;
  destinoFisico: DestinoFisicoDespacho;
  imputacionTipo: ImputacionDespacho;
  destinoProyectoId: string;
  destinoId: string;
  destinoPartidaKey: string;
  partidaLabel: string;
  cronogramaTareaId: string;
  tareaEtiqueta: string;
  tareaPartidaId: string;
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

const emptyDestinoDoc = (): DespachoDestinoDocumentoValue => ({
  tipoDestino: 'obra',
  destinoFisico: 'obra_actual',
  destinoProyectoId: '',
  destinoId: '',
  destinoEtiqueta: '',
  capituloId: '',
  capituloLabel: '',
  imputacionObra: 'partida',
  partidaKey: '',
  partidaLabel: '',
  actividadTexto: '',
  cronogramaTareaId: '',
  tareaEtiqueta: '',
});

function distribucionDesdePartidaKey(
  cantidad: number,
  partidaKey: string,
): DistribucionDespachoState {
  if (!partidaKey.trim() || cantidad <= 0) return emptyDistribucion();
  const imputaciones: ImputacionPartidaInput[] = [
    partidaKey.startsWith('pp:')
      ? { ci_presupuesto_partida_id: partidaKey.slice(3), cantidad_imputada: cantidad }
      : partidaKey.startsWith('pd:')
        ? { partida_id: partidaKey.slice(3), cantidad_imputada: cantidad }
        : { ci_presupuesto_partida_id: partidaKey, cantidad_imputada: cantidad },
  ];
  return {
    imputaciones,
    totalImputado: cantidad,
    saldo: 0,
    valido: true,
  };
}

function aplicarDestinoDocALinea(
  linea: LineaDespacho,
  doc: DespachoDestinoDocumentoValue,
): LineaDespacho {
  const partidaKey = doc.partidaKey;
  const esActividad = doc.tipoDestino === 'obra' && doc.imputacionObra === 'actividad';
  const distribucion =
    partidaKey && linea.cantidadSalida > 0
      ? distribucionDesdePartidaKey(linea.cantidadSalida, partidaKey)
      : emptyDistribucion();

  const etiquetaPartes = [doc.destinoEtiqueta];
  if (doc.tipoDestino === 'obra') {
    if (doc.capituloLabel) etiquetaPartes.push(`Cap. ${doc.capituloLabel}`);
    if (doc.imputacionObra === 'partida' && doc.partidaLabel) {
      etiquetaPartes.push(`Partida: ${doc.partidaLabel}`);
    }
    if (esActividad) {
      const act = doc.tareaEtiqueta || doc.actividadTexto.trim();
      if (act) etiquetaPartes.push(`Actividad: ${act}`);
    }
  }

  return {
    ...linea,
    destinoFisico: doc.destinoFisico,
    destinoProyectoId: doc.destinoProyectoId,
    destinoId: doc.destinoId,
    destinoEtiqueta: etiquetaPartes.filter(Boolean).join(' · '),
    imputacionTipo: esActividad && doc.cronogramaTareaId ? 'actividad' : 'partida_lulo',
    destinoPartidaKey: partidaKey,
    partidaLabel: doc.partidaLabel,
    cronogramaTareaId: doc.cronogramaTareaId,
    tareaEtiqueta: doc.tareaEtiqueta || doc.actividadTexto.trim(),
    tareaPartidaId: '',
    distribucion,
  };
}

function destinoDocCompleto(doc: DespachoDestinoDocumentoValue): boolean {
  if (!doc.destinoId) return false;
  if (doc.tipoDestino === 'almacen') return true;
  if (!doc.capituloId) return false;
  if (doc.imputacionObra === 'actividad') {
    return Boolean(doc.actividadTexto.trim() || doc.cronogramaTareaId);
  }
  return true;
}

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
  const [cantidadAgregar, setCantidadAgregar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [receptor, setReceptor] = useState<ReceptorDespachoValue>({
    modo: 'nomina',
    empleadoId: '',
    nombre: '',
    oficio: '',
  });
  const [fotos, setFotos] = useState<FotoDespachoItem[]>([]);
  const [destinoDoc, setDestinoDoc] = useState<DespachoDestinoDocumentoValue>(emptyDestinoDoc);
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
    setCantidadAgregar('');
    setReceptor({ modo: 'nomina', empleadoId: '', nombre: '', oficio: '' });
    setFotos([]);
    setDestinoDoc(emptyDestinoDoc());
  }, [proyectoId, origenId, cargarStock]);

  useEffect(() => {
    if (!destinoDocCompleto(destinoDoc)) return;
    setLineas((prev) => prev.map((l) => aplicarDestinoDocALinea(l, destinoDoc)));
  }, [destinoDoc]);

  const materialSeleccionado = stock.find((s) => stockKey(s) === materialAgregar);

  const parseCantidad = (raw: string, max: number): number | null => {
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n > max + 0.0001) return null;
    return n;
  };

  const agregarLinea = () => {
    if (!destinoDocCompleto(destinoDoc)) {
      toast.error('Complete almacén/obra destino y capítulo antes de agregar materiales.');
      return;
    }
    const hit = materialSeleccionado;
    if (!hit) return;
    const qty = parseCantidad(cantidadAgregar, hit.cantidad_disponible);
    if (qty == null) {
      toast.error(`Indique una cantidad entre 0 y ${hit.cantidad_disponible} ${hit.unidad}`);
      return;
    }
    if (lineas.some((l) => lineaStockKey(l) === stockKey(hit))) {
      toast.error('Ese material en ese almacén ya está en la lista');
      return;
    }
    if (hit.ubicacion_id === destinoDoc.destinoId) {
      toast.error('Origen y destino no pueden ser el mismo almacén');
      return;
    }
    const base: LineaDespacho = {
      lineId: lineId(),
      material_id: hit.material_id,
      origen_ubicacion_id: hit.ubicacion_id,
      origen_nombre: hit.ubicacion_nombre,
      nombre: hit.nombre,
      unidad: hit.unidad,
      categoria: hit.categoria,
      maxStock: hit.cantidad_disponible,
      cantidadSalida: qty,
      destinoFisico: destinoDoc.destinoFisico,
      imputacionTipo: 'partida_lulo',
      destinoProyectoId: destinoDoc.destinoProyectoId,
      destinoId: destinoDoc.destinoId,
      destinoPartidaKey: destinoDoc.partidaKey,
      partidaLabel: destinoDoc.partidaLabel,
      cronogramaTareaId: '',
      tareaEtiqueta: '',
      tareaPartidaId: '',
      destinoEtiqueta: '',
      distribucion: emptyDistribucion(),
    };
    setLineas((prev) => [...prev, aplicarDestinoDocALinea(base, destinoDoc)]);
    setMaterialAgregar('');
    setCantidadAgregar('');
  };

  const quitarLinea = (id: string) => {
    setLineas((prev) => prev.filter((l) => l.lineId !== id));
  };

  const destinoFisicoCompleto = (l: LineaDespacho): boolean => {
    if (l.destinoFisico === 'obra_actual') return Boolean(l.destinoId);
    if (l.destinoFisico === 'otra_obra') return Boolean(l.destinoProyectoId && l.destinoId);
    return Boolean(l.destinoId);
  };

  const imputacionCompleta = (l: LineaDespacho): boolean => {
    if (destinoDoc.tipoDestino === 'almacen') return true;
    if (l.destinoPartidaKey) return l.distribucion.valido || destinoDoc.capituloId.length > 0;
    if (destinoDoc.imputacionObra === 'actividad') {
      return Boolean(destinoDoc.actividadTexto.trim() || destinoDoc.cronogramaTareaId);
    }
    return Boolean(destinoDoc.capituloId);
  };

  const lineaLista = (l: LineaDespacho): boolean => {
    const mov = l.distribucion.totalImputado;
    const conPartida = Boolean(l.destinoPartidaKey);
    return (
      destinoDocCompleto(destinoDoc) &&
      destinoFisicoCompleto(l) &&
      imputacionCompleta(l) &&
      l.origen_ubicacion_id !== l.destinoId &&
      l.cantidadSalida > 0 &&
      l.cantidadSalida <= l.maxStock &&
      (conPartida
        ? mov > 0 && mov <= l.cantidadSalida + 0.0001 && l.distribucion.valido
        : true)
    );
  };

  const puedeGuardar =
    logisticaAutorizada &&
    proyectoId &&
    destinoDocCompleto(destinoDoc) &&
    receptor.nombre.trim().length > 0 &&
    lineas.length > 0 &&
    lineas.every(lineaLista);

  const guardar = async () => {
    if (!logisticaAutorizada) {
      toast.error('Registre el Contrato AD del proyecto antes de despachar materiales.');
      return;
    }
    if (!receptor.nombre.trim()) {
      toast.error('Indique el obrero que recibe el material.');
      return;
    }
    if (!puedeGuardar) {
      toast.error('Complete destino, capítulo, cantidades y obrero receptor.');
      return;
    }

    await runLocked(async () => {
      try {
        const lineasPayload = await Promise.all(
          lineas.map(async (l) => {
            let imputaciones = l.distribucion.imputaciones as ImputacionPartidaInput[];
            let cantidad = l.distribucion.totalImputado || l.cantidadSalida;
            let partidaKey = l.destinoPartidaKey;
            let partidaLabel = l.partidaLabel;

            if (!imputaciones.length && destinoDoc.tipoDestino === 'almacen') {
              cantidad = l.cantidadSalida;
            } else if (!imputaciones.length) {
              if (partidaKey) {
                const dist = distribucionDesdePartidaKey(l.cantidadSalida, partidaKey);
                imputaciones = dist.imputaciones;
                cantidad = l.cantidadSalida;
              } else if (destinoDoc.capituloId) {
                const q = new URLSearchParams({
                  proyecto_id: proyectoId,
                  capitulo_id: destinoDoc.capituloId,
                });
                const resPar = await fetch(`/api/almacen/partidas-capitulo?${q}`, {
                  cache: 'no-store',
                });
                const dataPar = (await resPar.json()) as {
                  partidas?: Array<{ key: string; nombre: string }>;
                  error?: string;
                };
                if (!resPar.ok) throw new Error(dataPar.error || 'No se pudieron cargar partidas');
                const first = dataPar.partidas?.[0];
                if (!first?.key) {
                  throw new Error(
                    `El capítulo «${destinoDoc.capituloLabel}» no tiene partidas para imputar.`,
                  );
                }
                partidaKey = first.key;
                partidaLabel = first.nombre;
                imputaciones = distribucionDesdePartidaKey(l.cantidadSalida, first.key).imputaciones;
                cantidad = l.cantidadSalida;
              }
            }

            const imp = imputaciones[0];
            return {
              material_id: l.material_id,
              material_nombre: l.nombre,
              unidad: l.unidad,
              cantidad,
              origen_ubicacion_id: l.origen_ubicacion_id,
              destino_ubicacion_id: l.destinoId,
              destino_fisico: l.destinoFisico,
              imputacion_tipo: l.imputacionTipo,
              imputaciones,
              ci_presupuesto_partida_id:
                imp?.ci_presupuesto_partida_id ??
                (partidaKey.startsWith('pp:') ? partidaKey.slice(3) : null),
              partida_id:
                imp?.partida_id ?? (partidaKey.startsWith('pd:') ? partidaKey.slice(3) : null),
              partida_label: partidaLabel || destinoDoc.capituloLabel || null,
              cronograma_tarea_id: l.cronogramaTareaId || destinoDoc.cronogramaTareaId || null,
              tarea_label: l.tareaEtiqueta || destinoDoc.tareaEtiqueta || destinoDoc.actividadTexto.trim() || null,
            };
          }),
        );

        const payload = {
          proyectoId,
          observaciones,
          obreroEmpleadoId: receptor.empleadoId || null,
          obreroNombre: receptor.nombre.trim(),
          obreroOficio: receptor.oficio.trim() || null,
          lineas: lineasPayload,
        };

        const form = new FormData();
        form.append('payload', JSON.stringify(payload));
        fotos.forEach((f, i) => form.append(`foto${i}`, f.file));

        const res = await fetch('/api/almacen/despacho', { method: 'POST', body: form });
        const data = (await res.json()) as {
          codigos?: string[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'No se pudo registrar el despacho');

        const codigos = data.codigos ?? [];
        toast.success(
          codigos.length > 1
            ? `Despachos ${codigos.join(', ')} registrados`
            : `Despacho ${codigos[0] ?? ''} registrado`,
        );
        setLineas([]);
        setObservaciones('');
        setReceptor({ modo: 'nomina', empleadoId: '', nombre: '', oficio: '' });
        setDestinoDoc(emptyDestinoDoc());
        fotos.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        setFotos([]);
        void cargarStock(proyectoId, origenId || undefined);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar');
      }
    });
  };

  const stockDisponible = stock.filter(
    (s) => !lineas.some((l) => lineaStockKey(l) === stockKey(s)),
  );

  const almacenesSugeridosIds = Array.from(new Set(stock.map((s) => s.ubicacion_id)));

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
              Obra origen, almacén/obra destino, capítulo e imputación opcional por partida.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {proyectoId && !cargandoContratoAd && !logisticaAutorizada ? (
          <ProyectoAdLogisticaBanner proyectoId={proyectoId} autorizado={logisticaAutorizada} />
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
            {proyectosError ? (
              <p className="text-[10px] font-bold text-amber-400">{proyectosError}</p>
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
          </div>
          {proyectoId ? (
            <>
              <ReceptorDespachoSelect proyectoId={proyectoId} value={receptor} onChange={setReceptor} />
              <FotosDespachoInput fotos={fotos} onChange={setFotos} />
              <DespachoAlertasConfigPanel
                proyectoId={proyectoId}
                onConfigChange={onAlertasConfigChange}
              />
              <DespachoDestinoDocumentoPanel
                proyectoId={proyectoId}
                proyectoNombre={nombreProyecto}
                origenUbicacionId={origenId || undefined}
                almacenesSugeridosIds={almacenesSugeridosIds}
                value={destinoDoc}
                onChange={setDestinoDoc}
              />
            </>
          ) : null}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              placeholder="Transporte, vehículo, notas adicionales…"
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
          ) : stockDisponible.length === 0 && lineas.length === 0 ? (
            <p className="text-xs text-amber-400/90">
              No hay stock en los almacenes de {nombreProyecto}
              {origenId ? ' en el almacén filtrado' : ''}.
            </p>
          ) : stockDisponible.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                  Agregar material ({stockDisponible.length} disponibles)
                </label>
                <select
                  value={materialAgregar}
                  onChange={(e) => {
                    const key = e.target.value;
                    setMaterialAgregar(key);
                    const hit = stock.find((s) => stockKey(s) === key);
                    setCantidadAgregar(hit ? String(hit.cantidad_disponible) : '');
                  }}
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
              <div className="w-full sm:w-36">
                <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                  Cantidad
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  disabled={!materialAgregar}
                  value={cantidadAgregar}
                  onChange={(e) => setCantidadAgregar(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm disabled:opacity-40"
                />
              </div>
              <button
                type="button"
                disabled={
                  !materialAgregar ||
                  parseCantidad(cantidadAgregar, materialSeleccionado?.cantidad_disponible ?? 0) ==
                    null
                }
                onClick={agregarLinea}
                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
          ) : null}

          {lineas.map((linea) => (
            <div
              key={linea.lineId}
              className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-100">{linea.nombre}</p>
                  <p className="text-[11px] text-zinc-500">
                    Origen: {linea.origen_nombre} · stock: {linea.maxStock} {linea.unidad}
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

              {linea.destinoEtiqueta ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/8 px-3 py-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  <p className="text-xs leading-snug text-sky-100">{linea.destinoEtiqueta}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-orange-500/25 bg-black/20 p-3">
                <div className="w-full sm:w-40">
                  <label className="mb-1 block text-[10px] font-bold uppercase text-orange-400/90">
                    Cantidad a salir
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={linea.cantidadSalida}
                    onChange={(e) => {
                      const qty = parseCantidad(e.target.value, linea.maxStock);
                      if (qty == null && e.target.value.trim() !== '') {
                        toast.error(`Máximo ${linea.maxStock} ${linea.unidad}`);
                        return;
                      }
                      setLineas((prev) =>
                        prev.map((l) => {
                          if (l.lineId !== linea.lineId) return l;
                          const qtyVal = qty ?? 0;
                          const next = {
                            ...l,
                            cantidadSalida: qtyVal,
                            distribucion: l.destinoPartidaKey
                              ? distribucionDesdePartidaKey(qtyVal, l.destinoPartidaKey)
                              : emptyDistribucion(),
                          };
                          return next;
                        }),
                      );
                    }}
                    className="w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {linea.destinoPartidaKey && linea.cantidadSalida > 0 ? (
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
                  cantidadLinea={linea.cantidadSalida}
                  alertasConfig={alertasConfig}
                  onChange={(dist) => {
                    setLineas((prev) =>
                      prev.map((l) =>
                        l.lineId === linea.lineId ? { ...l, distribucion: dist } : l,
                      ),
                    );
                  }}
                />
              ) : destinoDoc.tipoDestino === 'obra' && destinoDoc.imputacionObra === 'actividad' ? (
                <p className="text-xs text-violet-200/90">
                  Actividad:{' '}
                  <strong>{destinoDoc.tareaEtiqueta || destinoDoc.actividadTexto}</strong>
                  {linea.cantidadSalida <= 0 ? ' — indique cantidad.' : ''}
                </p>
              ) : destinoDoc.capituloLabel && !linea.destinoPartidaKey ? (
                <p className="text-xs text-zinc-400">
                  Imputación al capítulo <strong className="text-zinc-200">{destinoDoc.capituloLabel}</strong>
                  {linea.cantidadSalida <= 0 ? ' — indique cantidad a salir.' : ' (sin partida específica).'}
                </p>
              ) : linea.cantidadSalida <= 0 ? (
                <p className="text-xs text-amber-400/90">Indique cantidad a salir.</p>
              ) : null}
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
