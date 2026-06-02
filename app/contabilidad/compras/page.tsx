'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDeleteCompraError } from '@/lib/contabilidad/deleteCompraRegistro';
import {
    etiquetaPeriodo,
    rangoFechasPeriodo,
    todayIso,
    type PeriodoCompras,
} from '@/lib/contabilidad/comprasFiltros';
import {
    compraIdsPorArticulo,
    compraIdsPorCantidad,
    dedupeProveedores,
    orFiltroBusquedaCompras,
    parseMontoFiltro,
    patronIlike,
    type ProveedorOpcion,
} from '@/lib/contabilidad/comprasQueryFiltros';
import {
    compraCumpleFiltroRif,
    compraCumpleFiltrosDestino,
    compraCumpleFiltrosLineas,
    compraCumpleFiltrosMontos,
    filtrarLineasComprasConfirmadas,
} from '@/lib/contabilidad/filtrosFacturaCanal';
import ComprasLineasTable from '@/components/contabilidad/ComprasLineasTable';
import ComprasFiltrosPanel, {
    buildComprasFiltrosChips,
    ComprasFiltrosActivosBar,
    ComprasFiltrosSeleccionObra,
    type EntidadOpcion,
} from '@/components/contabilidad/ComprasFiltrosPanel';
import type { EstadoLogisticaCompra } from '@/lib/contabilidad/estadoLogisticaCompra';
import {
    loadCatalogoProyectosApp,
    mergeProyectosCatalogo,
    type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import {
    Filter,
    FileText,
    Loader2,
    MapPin,
    PackageCheck,
    Pencil,
    Printer,
    RefreshCw,
    Search,
    Share2,
    Trash2,
} from 'lucide-react';
import ReubicarCompraModal from '@/components/contabilidad/ReubicarCompraModal';
import EditarFacturaCanalModal from '@/components/contabilidad/EditarFacturaCanalModal';
import CompraFacturaImagen from '@/components/contabilidad/CompraFacturaImagen';
import CompraProductosToggle from '@/components/contabilidad/CompraProductosToggle';
import EtiquetaBimonetariaCompra from '@/components/contabilidad/EtiquetaBimonetariaCompra';
import {
    formatearBs,
    formatearTasaBcv,
    formatearUsd,
    montoUsdCompra,
    montoVesCompra,
    tasaBcvCompra,
    vesAUsdConTasa,
} from '@/lib/contabilidad/comprasMontos';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import { useTasasBcvPorFechas } from '@/lib/contabilidad/useTasasBcvPorFechas';
import { tasaBcvPorFechaCompra } from '@/lib/contabilidad/tasaBcvPorFechaCompra';
import { cargarCanalParaCompras } from '@/lib/contabilidad/cargarCanalParaCompras';
import {
    extractedDesdeCompraLista,
    normalizarMonedaExtracted,
    type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import { actualizarPendienteCanal, eliminarPendienteCanal } from '@/lib/contabilidad/facturaCanalApi';
import {
    compraCoincideFuente,
    etiquetaOrigenCompra,
    type CanalPendienteParaLista,
    unificarComprasConCanal,
    type CompraListaUnificada,
    type FiltroFuenteCompra,
} from '@/lib/contabilidad/mapCanalPendienteCompra';
import { enriquecerComprasConDestino } from '@/lib/contabilidad/enriquecerComprasDestino';
import { enriquecerComprasPuenteInventario } from '@/lib/contabilidad/enriquecerComprasPuenteInventario';
import {
    coloresEstadoLogistica,
    compraPermiteIngresoAlmacen,
    enriquecerComprasEstadoLogistica,
    etiquetaEstadoLogistica,
} from '@/lib/contabilidad/estadoLogisticaCompra';
import {
    compraTieneDetallePuenteInventario,
    lineasDetallePuenteInventario,
} from '@/lib/contabilidad/formatDetalleLogisticaCompra';
import {
    buildComprasCuadroShareUrl,
    borrarComprasCuadroFiltrosGuardados,
    comprasCuadroPathFromState,
    copiarTextoCuadro,
    guardarComprasCuadroFiltros,
    hasComprasCuadroShareParams,
    leerComprasCuadroFiltrosGuardados,
    parseComprasCuadroShareParams,
    type ComprasCuadroFiltrosState,
} from '@/lib/contabilidad/comprasCuadroShare';
import { abrirComprasCuadroVentana } from '@/lib/contabilidad/comprasCuadroPrintHtml';
import {
    lineasComprasATsv,
    ordenarLineasCompras,
    type ColumnaOrdenCompras,
    type DireccionOrden,
} from '@/lib/contabilidad/ordenarLineasCompras';
import {
    monedaOriginalCompra,
    montosBimonetariosLista,
    montoNominalMonedaOriginal,
    subtotalBsLineaCompra,
    subtotalUsdLineaCompra,
} from '@/lib/contabilidad/monedaCompra';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';

type CompraRow = CompraListaUnificada;

type LineaDetalle = {
    descripcion: string;
    item_code: string | null;
    subtotal: number;
    cantidad: number;
    precio_unitario?: number;
};

type ProyectoOpcion = ProyectoCatalogo;

const glass = {
    background: 'rgba(28, 28, 30, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '12px 14px',
    color: 'white',
    fontWeight: 700,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
};

const inputMontoStyle: React.CSSProperties = {
    ...inputStyle,
    padding: '8px 10px',
    fontSize: '13px',
    borderRadius: '10px',
    minWidth: 0,
};

const periodBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: '12px',
    border: active ? '1px solid #5856D6' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(88,86,214,0.25)' : 'rgba(255,255,255,0.05)',
    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
});

function lineasDetalle(row: CompraRow): LineaDetalle[] {
    const nested = row.contabilidad_compra_lineas;
    if (!Array.isArray(nested) || !nested.length) return [];
    const first = nested[0];
    if (first && 'descripcion' in first) return nested as LineaDetalle[];
    return [];
}

function lineCount(row: CompraRow): number {
    const det = lineasDetalle(row);
    if (det.length) return det.length;
    const nested = row.contabilidad_compra_lineas;
    if (Array.isArray(nested) && nested[0] && 'count' in nested[0] && typeof nested[0].count === 'number') {
        return nested[0].count;
    }
    return 0;
}

function puedeReubicarCompra(c: CompraRow): boolean {
    return (
        c.fuente_lista === 'app' ||
        Boolean(c.purchase_invoice_id) ||
        Boolean(c.pendiente_canal_id) ||
        c.estado === 'REGISTRADA' ||
        c.canal_estado === 'confirmado' ||
        c.canal_estado === 'extraido'
    );
}

function compraPuedeVerImagen(c: CompraRow): boolean {
    return Boolean(
        c.document_storage_path ||
            c.purchase_invoice_id ||
            c.origen === 'RECEPCION_MERCANCIA' ||
            c.origen === 'TELEGRAM' ||
            c.pendiente_canal_id,
    );
}

export default function ComprasPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [compras, setCompras] = useState<CompraRow[]>([]);
    const [proyectos, setProyectos] = useState<ProyectoOpcion[]>([]);
    const [entidades, setEntidades] = useState<EntidadOpcion[]>([]);
    const [proveedores, setProveedores] = useState<ProveedorOpcion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [avisoCanal, setAvisoCanal] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [ingresandoAlmacenId, setIngresandoAlmacenId] = useState<string | null>(null);
    const [cambiandoMonedaId, setCambiandoMonedaId] = useState<string | null>(null);
    const [editandoCanal, setEditandoCanal] = useState<{
        pendienteId: string;
        extracted: ExtractedCanalHeader;
    } | null>(null);
    const [reubicarCompra, setReubicarCompra] = useState<{
        id: string;
        entidadId?: string | null;
        proyectoId?: string | null;
        ubicacionId?: string | null;
        titulo?: string;
    } | null>(null);

    const [hydrated, setHydrated] = useState(false);
    const [periodo, setPeriodo] = useState<PeriodoCompras>('todas');
    const [fechaRef, setFechaRef] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [proyectoFiltro, setProyectoFiltro] = useState<string>('');
    const [entidadFiltro, setEntidadFiltro] = useState<string>('');
    const [proveedorFiltro, setProveedorFiltro] = useState<string>('');
    const [rifFiltro, setRifFiltro] = useState('');
    const [articuloFiltro, setArticuloFiltro] = useState('');
    const [cantidadMin, setCantidadMin] = useState('');
    const [cantidadMax, setCantidadMax] = useState('');
    const [montoMinBs, setMontoMinBs] = useState('');
    const [montoMaxBs, setMontoMaxBs] = useState('');
    const [montoMinUsd, setMontoMinUsd] = useState('');
    const [montoMaxUsd, setMontoMaxUsd] = useState('');
    const [vistaListado, setVistaListado] = useState<'facturas' | 'lineas'>('lineas');
    const [imagenFacturaAbierta, setImagenFacturaAbierta] = useState<string | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');
    const [fuenteFiltro, setFuenteFiltro] = useState<FiltroFuenteCompra>('todos');
    const [estadoLogisticaFiltro, setEstadoLogisticaFiltro] = useState<EstadoLogisticaCompra | ''>('');
    const [compartidoOk, setCompartidoOk] = useState(false);
    const [sortColumn, setSortColumn] = useState<ColumnaOrdenCompras | null>(null);
    const [sortDir, setSortDir] = useState<DireccionOrden>('asc');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deletingBulk, setDeletingBulk] = useState(false);
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
    const selectAllRef = useRef<HTMLInputElement>(null);
    const proyectosIdsRef = useRef<Set<string>>(new Set());
    const shareParamsAplicados = useRef(false);
    const filtrosPersistenciaLista = useRef(false);
    const autoAbrirFiltrosHecho = useRef(false);

    const aplicarFiltrosCuadro = useCallback((parsed: Partial<ComprasCuadroFiltrosState>) => {
        if (parsed.fuenteFiltro) setFuenteFiltro(parsed.fuenteFiltro);
        if (parsed.periodo) setPeriodo(parsed.periodo);
        if (parsed.fechaRef) setFechaRef(parsed.fechaRef);
        if (parsed.fechaDesde) setFechaDesde(parsed.fechaDesde);
        if (parsed.fechaHasta) setFechaHasta(parsed.fechaHasta);
        if (parsed.proyectoFiltro) setProyectoFiltro(parsed.proyectoFiltro);
        if (parsed.entidadFiltro) setEntidadFiltro(parsed.entidadFiltro);
        if (parsed.proveedorFiltro) setProveedorFiltro(parsed.proveedorFiltro);
        if (parsed.rifFiltro) setRifFiltro(parsed.rifFiltro);
        if (parsed.articuloFiltro) setArticuloFiltro(parsed.articuloFiltro);
        if (parsed.cantidadMin) setCantidadMin(parsed.cantidadMin);
        if (parsed.cantidadMax) setCantidadMax(parsed.cantidadMax);
        if (parsed.montoMinBs) setMontoMinBs(parsed.montoMinBs);
        if (parsed.montoMaxBs) setMontoMaxBs(parsed.montoMaxBs);
        if (parsed.montoMinUsd) setMontoMinUsd(parsed.montoMinUsd);
        if (parsed.montoMaxUsd) setMontoMaxUsd(parsed.montoMaxUsd);
        if (parsed.vistaListado) setVistaListado(parsed.vistaListado);
        if (parsed.estadoLogisticaFiltro) setEstadoLogisticaFiltro(parsed.estadoLogisticaFiltro);
        if (parsed.busqueda) {
            setBusqueda(parsed.busqueda);
            setBusquedaAplicada(parsed.busqueda);
        }
        if (parsed.sortColumn) setSortColumn(parsed.sortColumn);
        if (parsed.sortDir) setSortDir(parsed.sortDir);
    }, []);

    useEffect(() => {
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated || shareParamsAplicados.current) return;
        shareParamsAplicados.current = true;

        const fromUrl = hasComprasCuadroShareParams(searchParams)
            ? parseComprasCuadroShareParams(searchParams)
            : null;
        const fromStorage = !fromUrl ? leerComprasCuadroFiltrosGuardados() : null;
        const parsed = fromUrl ?? fromStorage ?? {};

        aplicarFiltrosCuadro(parsed);
        if (!parsed.fechaRef) setFechaRef(todayIso());

        filtrosPersistenciaLista.current = true;
    }, [hydrated, searchParams, aplicarFiltrosCuadro]);

    const fechaRefActiva = fechaRef || (hydrated ? todayIso() : '');
    const { tasa: tasaBcvHoy, fuente: tasaBcvFuente, loading: cargandoTasaHoy } = useTasaBcvHoy(
        fechaRefActiva || undefined,
    );

    const { getTasa: tasaBcvDelDiaFactura, loading: cargandoTasasFacturas } =
        useTasasBcvPorFechas(compras);

    const tasaParaCompra = useCallback(
        (c: CompraRow) => tasaBcvPorFechaCompra(c, tasaBcvDelDiaFactura),
        [tasaBcvDelDiaFactura],
    );

    const rangoActivo = useMemo(
        () =>
            fechaRefActiva
                ? rangoFechasPeriodo(periodo, fechaRefActiva, { desde: fechaDesde, hasta: fechaHasta })
                : null,
        [periodo, fechaRefActiva, fechaDesde, fechaHasta],
    );

    useEffect(() => {
        const id = window.setTimeout(() => setBusquedaAplicada(busqueda.trim()), 350);
        return () => window.clearTimeout(id);
    }, [busqueda]);

    const loadProveedores = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data } = await supabase
                .from('contabilidad_compras')
                .select('supplier_name, supplier_rif')
                .order('supplier_name')
                .limit(800);
            if (data?.length) {
                setProveedores(dedupeProveedores(data as { supplier_name: string; supplier_rif: string }[]));
            }
        } catch {
            /* catálogo opcional */
        }
    }, []);

    useEffect(() => {
        const t = window.setTimeout(() => void loadProveedores(), 1500);
        return () => window.clearTimeout(t);
    }, [loadProveedores]);

    const loadProyectosCatalogo = useCallback(async () => {
        try {
            const supabase = createClient();
            const { proyectos: lista, error: catErr } = await loadCatalogoProyectosApp(supabase);
            if (!catErr && lista.length) setProyectos(lista);
        } catch {
            /* catálogo opcional */
        }
    }, []);

    useEffect(() => {
        void loadProyectosCatalogo();
    }, [loadProyectosCatalogo]);

    const proyectosMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const p of proyectos) m.set(p.id, p.nombre);
        proyectosIdsRef.current = new Set(proyectos.map((p) => p.id));
        return m;
    }, [proyectos]);

    const loadEntidades = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data } = await supabase
                .from('ci_entidades')
                .select('id,nombre')
                .order('nombre')
                .limit(300);
            if (data?.length) {
                setEntidades(
                    (data as { id: string; nombre: string | null }[]).map((e) => ({
                        id: e.id,
                        nombre: (e.nombre || 'Entidad').trim(),
                    })),
                );
            }
        } catch {
            /* catálogo opcional */
        }
    }, []);

    useEffect(() => {
        const t = window.setTimeout(() => void loadEntidades(), 1200);
        return () => window.clearTimeout(t);
    }, [loadEntidades]);

    const entidadesMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const e of entidades) m.set(e.id, e.nombre);
        return m;
    }, [entidades]);

    const entidadFiltroEtiqueta = useMemo(() => {
        if (!entidadFiltro) return 'Todas las entidades';
        if (entidadFiltro === 'sin_entidad') return 'Sin entidad asignada';
        return entidadesMap.get(entidadFiltro) ?? 'Entidad';
    }, [entidadFiltro, entidadesMap]);

    const handleEntidadFiltro = useCallback(
        (next: string) => {
            setEntidadFiltro(next);
            if (!next || next === 'sin_entidad') return;
            if (!proyectoFiltro || proyectoFiltro === 'sin_proyecto') return;
            const proy = proyectos.find((p) => p.id === proyectoFiltro);
            if (proy?.entidad_id && proy.entidad_id !== next) {
                setProyectoFiltro('');
            }
        },
        [proyectoFiltro, proyectos],
    );

    const proyectoFiltroEtiqueta = useMemo(() => {
        if (!proyectoFiltro) return 'Todos los proyectos';
        if (proyectoFiltro === 'sin_proyecto') return 'Sin proyecto asignado';
        return proyectosMap.get(proyectoFiltro) ?? 'Proyecto';
    }, [proyectoFiltro, proyectosMap]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setAvisoCanal(null);
        try {
            const artTerm = articuloFiltro.trim();
            let minCant = parseMontoFiltro(cantidadMin);
            let maxCant = parseMontoFiltro(cantidadMax);
            if (minCant !== null && maxCant !== null && minCant > maxCant) {
                [minCant, maxCant] = [maxCant, minCant];
            }

            const [{ pendientes: canalPendientes, error: errorCanal }, supabase] = await Promise.all([
                cargarCanalParaCompras(),
                Promise.resolve(createClient()),
            ]);
            if (errorCanal) setAvisoCanal(errorCanal);

            const [idsArticuloBusqueda, idsArt, idsCant] = await Promise.all([
                busquedaAplicada
                    ? compraIdsPorArticulo(supabase, busquedaAplicada)
                    : Promise.resolve([] as string[]),
                artTerm ? compraIdsPorArticulo(supabase, artTerm) : Promise.resolve([] as string[]),
                minCant !== null || maxCant !== null
                    ? compraIdsPorCantidad(supabase, minCant, maxCant)
                    : Promise.resolve([] as string[]),
            ]);

            const orBusqueda = busquedaAplicada
                ? orFiltroBusquedaCompras(busquedaAplicada, idsArticuloBusqueda)
                : null;

            let idsPorLinea: string[] | null = null;
            if (artTerm) {
                idsPorLinea = idsArt;
            }
            if (minCant !== null || maxCant !== null) {
                idsPorLinea =
                    idsPorLinea === null
                        ? idsCant
                        : idsPorLinea.filter((id) => idsCant.includes(id));
            }

            const lineasSelect =
                'contabilidad_compra_lineas(descripcion,item_code,subtotal,cantidad,precio_unitario)';

            let minBs = parseMontoFiltro(montoMinBs);
            let maxBs = parseMontoFiltro(montoMaxBs);
            if (minBs !== null && maxBs !== null && minBs > maxBs) {
                [minBs, maxBs] = [maxBs, minBs];
            }
            let minUsd = parseMontoFiltro(montoMinUsd);
            let maxUsd = parseMontoFiltro(montoMaxUsd);
            if (minUsd !== null && maxUsd !== null && minUsd > maxUsd) {
                [minUsd, maxUsd] = [maxUsd, minUsd];
            }

            const rifPattern = patronIlike(rifFiltro);

            const selectLogistica =
                'compra_factura_id,ingresado_almacen_at,cuarentena_rechazo_total,compra_factura:compras_facturas(numero_factura,estado)';

            const buildComprasQuery = (conPuenteInventario = true) => {
                const camposPuente = conPuenteInventario ? `,${selectLogistica}` : '';
                let q = supabase
                    .from('contabilidad_compras')
                    .select(
                        `id,purchase_invoice_id,proyecto_id,entidad_id,ubicacion_destino_id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,total_amount_usd,tasa_bcv_ves_por_usd,moneda,moneda_original,monto_ves,monto_usd,origen,estado,document_file_name,document_storage_path,created_at,ci_proyectos(nombre),purchase_invoice:purchase_invoices(proyecto_id,entidad_id,ubicacion_destino_id)${camposPuente},${lineasSelect}`
                    )
                    .order('fecha', { ascending: false })
                    .order('created_at', { ascending: false });

                if (rangoActivo) {
                    q = q.gte('fecha', rangoActivo.desde).lte('fecha', rangoActivo.hasta);
                }
                if (proyectoFiltro === 'sin_proyecto') {
                    q = q.is('proyecto_id', null);
                } else if (proyectoFiltro) {
                    q = q.eq('proyecto_id', proyectoFiltro);
                }
                if (entidadFiltro === 'sin_entidad') {
                    q = q.is('entidad_id', null);
                } else if (entidadFiltro) {
                    q = q.eq('entidad_id', entidadFiltro);
                }
                if (proveedorFiltro) {
                    q = q.eq('supplier_name', proveedorFiltro);
                }
                if (rifPattern) {
                    q = q.ilike('supplier_rif', rifPattern);
                }
                if (minBs !== null) q = q.gte('total_amount', minBs);
                if (maxBs !== null) q = q.lte('total_amount', maxBs);
                if (orBusqueda) q = q.or(orBusqueda);
                if (idsPorLinea !== null) {
                    if (idsPorLinea.length === 0) {
                        q = q.eq('id', '00000000-0000-0000-0000-000000000000');
                    } else {
                        q = q.in('id', idsPorLinea.slice(0, 400));
                    }
                }
                return q;
            };

            const limiteCompras = periodo === 'todas' ? 800 : 500;
            let filas: CompraRow[] = [];

            {
                let { data, error: qErr } = await buildComprasQuery(true).limit(limiteCompras);
                if (
                    qErr &&
                    /compra_factura_id|ingresado_almacen_at|cuarentena_rechazo_total|compra_factura|42703|schema cache/i.test(
                        qErr.message ?? '',
                    )
                ) {
                    const retry = await buildComprasQuery(false).limit(limiteCompras);
                    data = retry.data;
                    qErr = retry.error;
                }
                if (qErr) {
                    if (
                        qErr.message.includes('contabilidad_compras') ||
                        qErr.message.includes('does not exist') ||
                        qErr.message.includes('proyecto_id')
                    ) {
                        throw new Error(
                            'Tabla de compras incompleta. Ejecute la migración 138_compras_proyecto_y_borrado.sql en Supabase.'
                        );
                    }
                    throw qErr;
                }
                filas = (data ?? []).map((row) => {
                    const r = row as unknown as CompraRow & {
                        purchase_invoice?: {
                            proyecto_id?: string | null;
                            entidad_id?: string | null;
                            ubicacion_destino_id?: string | null;
                        } | null;
                    };
                    const pi = r.purchase_invoice;
                    return {
                        ...r,
                        fuente_lista: r.fuente_lista ?? 'app',
                        proyecto_id: r.proyecto_id ?? pi?.proyecto_id ?? null,
                        entidad_id: r.entidad_id ?? pi?.entidad_id ?? null,
                        ubicacion_destino_id:
                            r.ubicacion_destino_id ?? pi?.ubicacion_destino_id ?? null,
                    };
                });
            }

            const idsConocidos = proyectosIdsRef.current;
            const faltantes: string[] = [];
            const vistos = new Set<string>();
            for (const f of filas) {
                const id = f.proyecto_id;
                if (id && !idsConocidos.has(id) && !vistos.has(id)) {
                    vistos.add(id);
                    faltantes.push(id);
                }
            }
            if (faltantes.length > 0) {
                const { data: extraProy } = await supabase
                    .from('ci_proyectos')
                    .select('id,nombre')
                    .in('id', faltantes.slice(0, 200));
                if (extraProy?.length) {
                    const extra = (extraProy as { id: string; nombre: string | null }[]).map((r) => ({
                        id: r.id,
                        nombre: (r.nombre || 'Sin nombre').trim(),
                    }));
                    setProyectos((prev) => mergeProyectosCatalogo(prev, extra));
                }
            }

            const filtrosAvanzados = {
                rif: rifFiltro,
                articulo: articuloFiltro,
                cantidadMin,
                cantidadMax,
                montoMinBs,
                montoMaxBs,
                montoMinUsd,
                montoMaxUsd,
            };

            filas = unificarComprasConCanal(
                filas.map((c) => ({ ...c, fuente_lista: c.fuente_lista ?? 'app' })),
                canalPendientes,
            );

            filas = filas.filter((c) => {
                if (!compraCoincideFuente(c, fuenteFiltro)) return false;
                if (!compraCumpleFiltroRif(c, rifFiltro)) return false;
                if (!compraCumpleFiltrosMontos(c, filtrosAvanzados)) return false;
                const lineas = lineasDetalle(c).map((l) => ({
                    descripcion: l.descripcion,
                    item_code: l.item_code,
                    cantidad: Number(l.cantidad) || 0,
                }));
                if (!compraCumpleFiltrosLineas(lineas, filtrosAvanzados)) return false;
                return true;
            });

            filas = await enriquecerComprasConDestino(supabase, filas);

            const filtrosDestino = {
                entidadFiltro,
                proyectoFiltro,
                proveedorFiltro,
                fechaDesde: periodo !== 'todas' ? rangoActivo?.desde : undefined,
                fechaHasta: periodo !== 'todas' ? rangoActivo?.hasta : undefined,
            };
            filas = filas.filter((c) => compraCumpleFiltrosDestino(c, filtrosDestino));

            filas = await enriquecerComprasPuenteInventario(supabase, filas);
            filas = await enriquecerComprasEstadoLogistica(supabase, filas);

            if (estadoLogisticaFiltro) {
                filas = filas.filter((c) => c.estado_logistica === estadoLogisticaFiltro);
            }

            setCompras(filas);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudieron cargar las compras.');
            setCompras([]);
        } finally {
            setLoading(false);
        }
    }, [
        periodo,
        rangoActivo,
        entidadFiltro,
        proyectoFiltro,
        proveedorFiltro,
        rifFiltro,
        articuloFiltro,
        cantidadMin,
        cantidadMax,
        montoMinBs,
        montoMaxBs,
        montoMinUsd,
        montoMaxUsd,
        busquedaAplicada,
        fuenteFiltro,
        estadoLogisticaFiltro,
    ]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (periodo === 'rango' && !fechaDesde && rangoActivo) {
            setFechaDesde(rangoActivo.desde);
            setFechaHasta(rangoActivo.hasta);
        }
    }, [periodo, rangoActivo, fechaDesde]);

    const idCanalTelegram = (c: CompraRow): string | null => {
        if (c.pendiente_canal_id) return c.pendiente_canal_id;
        if (c.id.startsWith('canal-')) return c.id.slice('canal-'.length);
        return null;
    };

    const abrirEditarTelegram = async (c: CompraRow) => {
        const canalId = idCanalTelegram(c);
        if (!canalId) return;
        try {
            const res = await fetch(`/api/facturas-canal/pendientes/${canalId}`, {
                cache: 'no-store',
            });
            const data = (await res.json()) as { extracted?: ExtractedCanalHeader | null; error?: string };
            if (res.ok && data.extracted) {
                setEditandoCanal({ pendienteId: canalId, extracted: data.extracted });
                return;
            }
        } catch {
            /* usar datos de la fila */
        }
        setEditandoCanal({
            pendienteId: canalId,
            extracted: extractedDesdeCompraLista({
                ...c,
                contabilidad_compra_lineas: lineasDetalle(c).map((l) => ({
                    descripcion: l.descripcion,
                    item_code: l.item_code,
                    cantidad: l.cantidad,
                    precio_unitario: l.precio_unitario,
                    subtotal: l.subtotal,
                })),
            }),
        });
    };

    const guardarEdicionTelegram = async (extracted: ExtractedCanalHeader) => {
        if (!editandoCanal) return;
        await actualizarPendienteCanal(editandoCanal.pendienteId, {
            extracted,
            mensaje_error: null,
        });
        setEditandoCanal(null);
        await load();
    };

    const cambiarMonedaCompra = async (c: CompraRow, moneda: MonedaOrigen) => {
        if (monedaOriginalCompra(c) === moneda) return;
        setCambiandoMonedaId(c.id);
        setError(null);
        try {
            const canalId = idCanalTelegram(c);
            const esSoloCanal = c.id.startsWith('canal-');

            if (esSoloCanal && canalId) {
                let extracted: ExtractedCanalHeader | null = null;
                try {
                    const res = await fetch(`/api/facturas-canal/pendientes/${canalId}`, {
                        cache: 'no-store',
                    });
                    const data = (await res.json()) as {
                        extracted?: ExtractedCanalHeader | null;
                    };
                    if (res.ok && data.extracted) extracted = data.extracted;
                } catch {
                    /* fallback fila */
                }
                const base =
                    extracted ??
                    extractedDesdeCompraLista({
                        ...c,
                        contabilidad_compra_lineas: lineasDetalle(c).map((l) => ({
                            descripcion: l.descripcion,
                            item_code: l.item_code,
                            cantidad: l.cantidad,
                            precio_unitario: l.precio_unitario,
                            subtotal: l.subtotal,
                        })),
                    });
                await actualizarPendienteCanal(canalId, {
                    extracted: {
                        ...base,
                        moneda,
                        total_amount: montoNominalMonedaOriginal(c),
                    },
                });
                setCompras((prev) =>
                    prev.map((row) =>
                        row.id === c.id
                            ? {
                                  ...row,
                                  moneda,
                                  moneda_original: moneda,
                              }
                            : row,
                    ),
                );
            } else {
                const res = await fetch(`/api/contabilidad/compras/${encodeURIComponent(c.id)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ moneda }),
                });
                const data = (await res.json()) as {
                    error?: string;
                    compra?: Partial<CompraRow>;
                };
                if (!res.ok) throw new Error(data.error || 'No se pudo cambiar la moneda');
                if (data.compra) {
                    setCompras((prev) =>
                        prev.map((row) =>
                            row.id === c.id ? { ...row, ...data.compra } : row,
                        ),
                    );
                }

                if (canalId) {
                    try {
                        const resCanal = await fetch(`/api/facturas-canal/pendientes/${canalId}`, {
                            cache: 'no-store',
                        });
                        const canalData = (await resCanal.json()) as {
                            extracted?: ExtractedCanalHeader | null;
                        };
                        if (resCanal.ok && canalData.extracted) {
                            await actualizarPendienteCanal(canalId, {
                                extracted: {
                                    ...canalData.extracted,
                                    moneda,
                                    total_amount: montoNominalMonedaOriginal(c),
                                },
                            });
                        }
                    } catch {
                        /* canal opcional */
                    }
                }
            }
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo cambiar la moneda');
        } finally {
            setCambiandoMonedaId(null);
        }
    };

    const eliminarCompraEnServidor = async (
        c: CompraRow,
        incluirDuplicados: boolean,
    ): Promise<{ ids: Set<string>; materialPermaneceEnStock?: boolean }> => {
        const canalId = idCanalTelegram(c);
        const q = new URLSearchParams({
            duplicados: incluirDuplicados ? '1' : '0',
        });
        if (canalId) q.set('canalId', canalId);
        const res = await fetch(`/api/contabilidad/compras/${c.id}?${q}`, {
            method: 'DELETE',
        });
        const data = (await res.json()) as {
            deletedIds?: string[];
            materialPermaneceEnStock?: boolean;
            error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'No se pudo eliminar');
        return {
            ids: new Set(data.deletedIds ?? [c.id]),
            materialPermaneceEnStock: data.materialPermaneceEnStock,
        };
    };

    const handleDelete = async (c: CompraRow) => {
        const canalId = idCanalTelegram(c);
        const esSoloColaCanal = c.id.startsWith('canal-');

        if (canalId && esSoloColaCanal) {
            const ok = window.confirm(
                '¿Eliminar esta factura pendiente de Telegram? Se perderán los datos extraídos.',
            );
            if (!ok) return;
            setDeletingId(c.id);
            setError(null);
            try {
                await eliminarPendienteCanal(canalId);
                setCompras((prev) => prev.filter((row) => row.id !== c.id));
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(c.id);
                    return next;
                });
            } catch (e) {
                setError(e instanceof Error ? e.message : 'No se pudo eliminar');
            } finally {
                setDeletingId(null);
            }
            return;
        }

        const duplicadasMismaFactura = compras.filter(
            (row) =>
                row.id !== c.id &&
                String(row.invoice_number ?? '').trim().replace(/^#+/, '') ===
                    String(c.invoice_number ?? '').trim().replace(/^#+/, '') &&
                (!c.supplier_rif ||
                    String(row.supplier_rif ?? '').trim().toUpperCase() ===
                        String(c.supplier_rif ?? '').trim().toUpperCase()),
        );
        const hayDuplicados = duplicadasMismaFactura.length > 0;
        const avisoDuplicado = hayDuplicados
            ? `\n\nExiste otro registro con factura #${c.invoice_number} (fechas: ${duplicadasMismaFactura.map((d) => d.fecha).join(', ')}).`
            : '';

        const ok = window.confirm(
            `¿Eliminar la compra de ${c.supplier_name}?\nFactura #${c.invoice_number} · ${c.fecha}${avisoDuplicado}\n\nSe quitará de contabilidad y recepción de mercancía.`,
        );
        if (!ok) return;

        let incluirDuplicados = false;
        if (hayDuplicados) {
            incluirDuplicados = window.confirm(
                `¿Eliminar TODOS los registros con factura #${c.invoice_number} del mismo proveedor (${duplicadasMismaFactura.length + 1} en total)?\n\nCancelar = solo esta fila (${c.fecha}).`,
            );
        }

        setDeletingId(c.id);
        setError(null);
        try {
            const removed = await eliminarCompraEnServidor(c, incluirDuplicados);
            setCompras((prev) => prev.filter((row) => !removed.ids.has(row.id)));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const id of Array.from(removed.ids)) next.delete(id);
                return next;
            });
            if (removed.materialPermaneceEnStock) {
                setError(
                    'Compra eliminada del listado. El material permanece en inventario porque ya estaba aprobado en recepción.',
                );
            }
            void load();
        } catch (e) {
            setError(formatDeleteCompraError(e));
            void load();
        } finally {
            setDeletingId(null);
        }
    };

    const handleBulkDelete = async () => {
        const items = compras.filter((c) => selectedIds.has(c.id));
        if (!items.length) return;

        const ok = window.confirm(
            `¿Eliminar ${items.length} compra(s) seleccionada(s)?\n\nSe quitarán de contabilidad y recepción de mercancía.`,
        );
        if (!ok) return;

        setDeletingBulk(true);
        setError(null);
        const removedAll = new Set<string>();
        let materialPermanece = false;
        let fallos = 0;

        for (const c of items) {
            const canalId = idCanalTelegram(c);
            const esSoloColaCanal = c.id.startsWith('canal-');
            try {
                if (canalId && esSoloColaCanal) {
                    await eliminarPendienteCanal(canalId);
                    removedAll.add(c.id);
                    continue;
                }
                const result = await eliminarCompraEnServidor(c, false);
                for (const id of Array.from(result.ids)) removedAll.add(id);
                if (result.materialPermaneceEnStock) materialPermanece = true;
            } catch {
                fallos += 1;
            }
        }

        setCompras((prev) => prev.filter((row) => !removedAll.has(row.id)));
        setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const id of Array.from(removedAll)) next.delete(id);
            return next;
        });

        if (fallos > 0) {
            setError(
                `${fallos} compra(s) no se pudieron eliminar. ${removedAll.size} eliminada(s) correctamente.`,
            );
        } else if (materialPermanece) {
            setError(
                'Compras eliminadas. El material permanece en inventario porque ya estaba aprobado en recepción.',
            );
        }

        void load();
        setDeletingBulk(false);
    };

    const handleIngresoAlmacen = async (c: CompraRow) => {
        if (!c.purchase_invoice_id) {
            setError('Esta compra no tiene documento base para ingreso a almacén.');
            return;
        }
        if (c.estado_logistica === 'en_almacen') {
            setError('Esta compra ya está totalmente en almacén.');
            return;
        }
        if (c.estado_logistica === 'rechazo_cuarentena') {
            setError('Todas las líneas fueron rechazadas en cuarentena. Revise la compra contable.');
            return;
        }
        setIngresandoAlmacenId(c.id);
        setError(null);
        try {
            const res = await fetch(`/api/contabilidad/compras/${c.id}/ingreso-almacen`, {
                method: 'POST',
            });
            const data = (await res.json()) as {
                yaExistia?: boolean;
                viaCuarentena?: boolean;
                aprobadas?: number;
                error?: string;
                sinMatch?: string[];
            };
            if (!res.ok) throw new Error(data.error || 'No se pudo registrar ingreso');
            if (data.yaExistia) {
                setError('Esta compra ya tenía ingreso registrado en almacén.');
            } else if (data.viaCuarentena) {
                setError(
                    data.aprobadas
                        ? `Cuarentena liberada: ${data.aprobadas} línea(s) ingresadas al almacén.`
                        : 'Material liberado desde cuarentena.',
                );
            }
            void load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo registrar ingreso');
        } finally {
            setIngresandoAlmacenId(null);
        }
    };

    const totalFiltrado = useMemo(() => {
        let totalUsd = 0;
        let totalBs = 0;
        const tasas = new Set<number>();
        const fechas = new Set<string>();
        let comprasSinTasaEnFactura = 0;

        for (const c of compras) {
            const tasaFactura = tasaParaCompra(c);
            const { bs, usd } = montosBimonetariosLista(c, tasaFactura);
            totalBs += bs;
            if (usd != null) totalUsd += usd;
            if (tasaBcvCompra(c)) {
                tasas.add(tasaBcvCompra(c)!);
            } else if (tasaFactura) {
                tasas.add(tasaFactura);
            } else {
                comprasSinTasaEnFactura += 1;
            }

            const f = String(c.fecha ?? '').slice(0, 10);
            if (f) fechas.add(f);
        }

        const tasasArr = Array.from(tasas);
        return {
            totalUsd: Math.round(totalUsd * 100) / 100,
            totalBs: Math.round(totalBs * 100) / 100,
            fechasDistintas: fechas.size,
            tasasDistintas: tasas.size,
            tasaUnica: tasasArr.length === 1 ? tasasArr[0] : null,
            comprasSinTasaEnFactura,
            tasaVariable: fechas.size > 1 || tasas.size > 1,
        };
    }, [compras, tasaParaCompra]);

    const filtrosLineas = useMemo(
        () => ({
            fechaDesde: fuenteFiltro === 'telegram' ? '' : (rangoActivo?.desde ?? ''),
            fechaHasta: fuenteFiltro === 'telegram' ? '' : (rangoActivo?.hasta ?? ''),
            proveedor: proveedorFiltro,
            rif: rifFiltro,
            articulo: articuloFiltro,
            cantidadMin,
            cantidadMax,
            montoMinBs,
            montoMaxBs,
            montoMinUsd,
            montoMaxUsd,
        }),
        [
            rangoActivo,
            fuenteFiltro,
            proveedorFiltro,
            rifFiltro,
            articuloFiltro,
            cantidadMin,
            cantidadMax,
            montoMinBs,
            montoMaxBs,
            montoMinUsd,
            montoMaxUsd,
        ],
    );

    const lineasFiltradas = useMemo(() => {
        const payload = compras.map((c) => ({
            id: c.id,
            fecha: c.fecha,
            invoice_number: c.invoice_number,
            supplier_name: c.supplier_name,
            supplier_rif: c.supplier_rif,
            total_amount: c.total_amount,
            total_amount_usd: c.total_amount_usd,
            tasa_bcv_ves_por_usd: tasaParaCompra(c),
            moneda: c.moneda,
            moneda_original: c.moneda_original,
            monto_ves: c.monto_ves,
            monto_usd: c.monto_usd,
            origen: c.origen,
            estado: c.estado,
            entidadNombre: c.entidad_nombre ?? undefined,
            proyectoNombre:
                c.proyecto_nombre ??
                (Array.isArray(c.ci_proyectos)
                    ? c.ci_proyectos[0]?.nombre ?? undefined
                    : c.ci_proyectos?.nombre ?? undefined),
            almacenNombre: c.ubicacion_nombre ?? undefined,
            lineas: lineasDetalle(c).map((l) => {
                const cantidad = Number(l.cantidad) || 0;
                const precio =
                    l.precio_unitario != null && Number(l.precio_unitario) >= 0
                        ? Number(l.precio_unitario)
                        : cantidad > 0
                          ? Number(l.subtotal) / cantidad
                          : 0;
                return {
                    descripcion: l.descripcion,
                    item_code: l.item_code,
                    cantidad,
                    precio_unitario: precio,
                    subtotal: Number(l.subtotal) || 0,
                };
            }),
        }));
        return filtrarLineasComprasConfirmadas(payload, filtrosLineas);
    }, [compras, filtrosLineas, tasaParaCompra]);

    const lineasOrdenadas = useMemo(
        () => ordenarLineasCompras(lineasFiltradas, sortColumn, sortDir),
        [lineasFiltradas, sortColumn, sortDir],
    );

    const ordenPlanoTabla = Boolean(sortColumn && sortColumn !== 'factura');

    const onSortColumna = useCallback(
        (col: ColumnaOrdenCompras) => {
            if (sortColumn === col) {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortColumn(col);
                setSortDir('asc');
            }
        },
        [sortColumn],
    );

    const totalLineasBs = useMemo(
        () =>
            Math.round(
                lineasOrdenadas.reduce((acc, row) => acc + subtotalBsLineaCompra(row), 0) * 100,
            ) / 100,
        [lineasOrdenadas],
    );

    const totalUsdLineasVista = useMemo(
        () =>
            Math.round(
                lineasOrdenadas.reduce((acc, row) => {
                    const usd = subtotalUsdLineaCompra(row);
                    return usd != null ? acc + usd : acc;
                }, 0) * 100,
            ) / 100,
        [lineasOrdenadas],
    );

    const showList = !loading && compras.length > 0;
    const showLineas = !loading && lineasOrdenadas.length > 0;

    const todasSeleccionadas = useMemo(
        () => compras.length > 0 && compras.every((c) => selectedIds.has(c.id)),
        [compras, selectedIds],
    );

    const algunaSeleccionada = selectedIds.size > 0;
    const seleccionIndeterminada = algunaSeleccionada && !todasSeleccionadas;

    useEffect(() => {
        const el = selectAllRef.current;
        if (el) el.indeterminate = seleccionIndeterminada;
    }, [seleccionIndeterminada]);

    useEffect(() => {
        setSelectedIds((prev) => {
            const visible = new Set(compras.map((c) => c.id));
            const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [compras]);

    const toggleSelectAll = useCallback(() => {
        setSelectedIds((prev) => {
            if (compras.length > 0 && compras.every((c) => prev.has(c.id))) {
                return new Set();
            }
            return new Set(compras.map((c) => c.id));
        });
    }, [compras]);

    const toggleSelectCompra = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const compraPorId = useMemo(() => new Map(compras.map((c) => [c.id, c])), [compras]);

    const accionesCompra = useCallback(
        (compraId: string) => {
            const c = compraPorId.get(compraId);
            if (!c) return null;
            const canalId = idCanalTelegram(c);
            return {
                puedeModificar: Boolean(canalId),
                etiquetaEliminar: 'Borrar',
            };
        },
        [compraPorId],
    );

    const onModificarCompra = useCallback(
        (compraId: string) => {
            const c = compraPorId.get(compraId);
            if (c) void abrirEditarTelegram(c);
        },
        [compraPorId],
    );

    const onEliminarCompra = useCallback(
        (compraId: string) => {
            const c = compraPorId.get(compraId);
            if (c) void handleDelete(c);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- handleDelete estable en uso
        [compraPorId],
    );
    const periodoLabel = fechaRefActiva ? etiquetaPeriodo(periodo, fechaRefActiva, rangoActivo) : '';

    const filtrosActivos = useMemo(
        () =>
            buildComprasFiltrosChips({
                fuenteFiltro,
                periodo,
                periodoLabel,
                proyectoFiltro,
                proyectoFiltroEtiqueta,
                entidadFiltro,
                entidadFiltroEtiqueta,
                proveedorFiltro,
                rifFiltro,
                articuloFiltro,
                busquedaAplicada,
                montoMinBs,
                montoMaxBs,
                montoMinUsd,
                montoMaxUsd,
                cantidadMin,
                cantidadMax,
                estadoLogisticaFiltro,
            }),
        [
            fuenteFiltro,
            periodo,
            periodoLabel,
            proyectoFiltro,
            proyectoFiltroEtiqueta,
            entidadFiltro,
            entidadFiltroEtiqueta,
            proveedorFiltro,
            rifFiltro,
            articuloFiltro,
            busquedaAplicada,
            montoMinBs,
            montoMaxBs,
            montoMinUsd,
            montoMaxUsd,
            cantidadMin,
            cantidadMax,
            estadoLogisticaFiltro,
        ],
    );

    const filtrosExtraCount = useMemo(
        () => filtrosActivos.filter((c) => c.id !== 'entidad' && c.id !== 'proyecto').length,
        [filtrosActivos],
    );

    const limpiarTodosFiltros = useCallback(() => {
        setPeriodo('todas');
        setFechaDesde('');
        setFechaHasta('');
        setProyectoFiltro('');
        setEntidadFiltro('');
        setProveedorFiltro('');
        setRifFiltro('');
        setArticuloFiltro('');
        setCantidadMin('');
        setCantidadMax('');
        setMontoMinBs('');
        setMontoMaxBs('');
        setMontoMinUsd('');
        setMontoMaxUsd('');
        setEstadoLogisticaFiltro('');
        setBusqueda('');
        setBusquedaAplicada('');
        setFuenteFiltro('todos');
        borrarComprasCuadroFiltrosGuardados();
        router.replace('/contabilidad/compras');
    }, [router]);

    const quitarFiltroChip = useCallback(
        (id: string) => {
            switch (id) {
                case 'fuente':
                    setFuenteFiltro('todos');
                    break;
                case 'periodo':
                    setPeriodo('todas');
                    break;
                case 'proyecto':
                    setProyectoFiltro('');
                    break;
                case 'entidad':
                    setEntidadFiltro('');
                    break;
                case 'proveedor':
                    setProveedorFiltro('');
                    break;
                case 'rif':
                    setRifFiltro('');
                    break;
                case 'articulo':
                    setArticuloFiltro('');
                    break;
                case 'busqueda':
                    setBusqueda('');
                    setBusquedaAplicada('');
                    break;
                case 'monto':
                    setMontoMinBs('');
                    setMontoMaxBs('');
                    setMontoMinUsd('');
                    setMontoMaxUsd('');
                    break;
                case 'cantidad':
                    setCantidadMin('');
                    setCantidadMax('');
                    break;
                case 'logistica':
                    setEstadoLogisticaFiltro('');
                    break;
                default:
                    break;
            }
        },
        [],
    );

    useEffect(() => {
        if (!hydrated || autoAbrirFiltrosHecho.current) return;
        if (filtrosActivos.length > 0) {
            setFiltrosAbiertos(true);
            autoAbrirFiltrosHecho.current = true;
        }
    }, [hydrated, filtrosActivos.length]);

    function tasaDisplayCompra(c: CompraRow): number | null {
        return tasaParaCompra(c);
    }

    const scrollToCompra = (compraId: string) => {
        setVistaListado('facturas');
        setImagenFacturaAbierta(compraId);
        requestAnimationFrame(() => {
            document.getElementById(`compra-card-${compraId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        });
    };

    const estadoCompartir = useMemo(
        (): ComprasCuadroFiltrosState => ({
            fuenteFiltro,
            periodo,
            fechaRef: fechaRefActiva,
            fechaDesde,
            fechaHasta,
            entidadFiltro,
            proyectoFiltro,
            proveedorFiltro,
            rifFiltro,
            busqueda: busquedaAplicada,
            articuloFiltro,
            cantidadMin,
            cantidadMax,
            montoMinBs,
            montoMaxBs,
            montoMinUsd,
            montoMaxUsd,
            vistaListado,
            sortColumn,
            sortDir,
            estadoLogisticaFiltro,
        }),
        [
            fuenteFiltro,
            periodo,
            fechaRefActiva,
            fechaDesde,
            fechaHasta,
            entidadFiltro,
            proyectoFiltro,
            proveedorFiltro,
            rifFiltro,
            busquedaAplicada,
            articuloFiltro,
            cantidadMin,
            cantidadMax,
            montoMinBs,
            montoMaxBs,
            montoMinUsd,
            montoMaxUsd,
            vistaListado,
            sortColumn,
            sortDir,
            estadoLogisticaFiltro,
        ],
    );

    useEffect(() => {
        if (!hydrated || !filtrosPersistenciaLista.current) return;
        guardarComprasCuadroFiltros(estadoCompartir);
        const path = comprasCuadroPathFromState(estadoCompartir);
        const actual = `${window.location.pathname}${window.location.search}`;
        if (path !== actual) {
            router.replace(path, { scroll: false });
        }
    }, [hydrated, estadoCompartir, router]);

    const subtituloCuadro = useMemo(() => {
        const partes = [
            periodoLabel,
            entidadFiltro ? entidadFiltroEtiqueta : null,
            proyectoFiltro ? proyectoFiltroEtiqueta : null,
            fuenteFiltro !== 'todos' ? `Fuente: ${fuenteFiltro}` : null,
            `${lineasOrdenadas.length} línea(s) · ${compras.length} factura(s)`,
        ].filter(Boolean);
        return partes.join(' · ');
    }, [
        periodoLabel,
        entidadFiltro,
        entidadFiltroEtiqueta,
        proyectoFiltro,
        proyectoFiltroEtiqueta,
        fuenteFiltro,
        lineasOrdenadas.length,
        compras.length,
    ]);

    const imprimirCuadro = () => {
        if (lineasOrdenadas.length === 0 && compras.length === 0) return;
        window.print();
    };

    const verPdfCuadro = () => {
        if (lineasOrdenadas.length === 0) return;
        try {
            abrirComprasCuadroVentana({
                subtitulo: subtituloCuadro,
                filas: lineasOrdenadas,
                totalUsd: totalUsdLineasVista,
                totalBs: totalLineasBs,
                sortColumn,
                sortDir,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo abrir la vista PDF');
        }
    };

    const compartirCuadro = async () => {
        if (typeof window === 'undefined' || (compras.length === 0 && lineasOrdenadas.length === 0)) return;
        const url = buildComprasCuadroShareUrl(window.location.origin, estadoCompartir);
        const resumen = `${lineasOrdenadas.length} línea(s) · ${compras.length} factura(s) · USD ${formatearUsd(totalFiltrado.totalUsd)} · Bs ${formatearBs(totalFiltrado.totalBs)}`;
        const titulo = 'Cuadro de compras — Casa Inteligente';
        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: titulo, text: resumen, url });
                return;
            } catch (e) {
                if (e instanceof Error && e.name === 'AbortError') return;
            }
        }
        const tsv = lineasOrdenadas.length > 0 ? `\n\n${lineasComprasATsv(lineasOrdenadas)}` : '';
        const ok = await copiarTextoCuadro(`${titulo}\n${resumen}\n${url}${tsv}`);
        if (ok) {
            setCompartidoOk(true);
            window.setTimeout(() => setCompartidoOk(false), 2000);
        }
    };

    const toggleImagenFactura = (compraId: string) => {
        setImagenFacturaAbierta((prev) => (prev === compraId ? null : compraId));
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
            <div
                className="compras-no-imprimir"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(20px)',
                    padding: '8px 16px',
                    minHeight: '40px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '28px' }}>
                    <Link
                        href="/contabilidad"
                        style={{
                            color: '#5856D6',
                            textDecoration: 'none',
                            fontSize: '16px',
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        ←
                    </Link>
                    <h1 style={{ color: 'white', fontSize: '17px', fontWeight: 800, lineHeight: 1.15, margin: 0 }}>
                        Compras
                    </h1>
                </div>
                <button
                    type="button"
                    onClick={() => setFiltrosAbiertos((v) => !v)}
                    aria-expanded={filtrosAbiertos}
                    style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: filtrosAbiertos || filtrosActivos.length ? '#fff' : 'rgba(255,255,255,0.7)',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border:
                            filtrosAbiertos || filtrosActivos.length
                                ? '1px solid rgba(88,86,214,0.55)'
                                : '1px solid rgba(255,255,255,0.15)',
                        background: filtrosAbiertos
                            ? 'rgba(88,86,214,0.35)'
                            : filtrosActivos.length
                              ? 'rgba(88,86,214,0.2)'
                              : 'rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                    }}
                >
                    <Filter size={13} />
                    Filtros
                    {filtrosActivos.length && !filtrosAbiertos ? (
                        <span
                            style={{
                                minWidth: 16,
                                height: 16,
                                padding: '0 4px',
                                borderRadius: 999,
                                background: '#5856D6',
                                fontSize: '9px',
                                fontWeight: 800,
                                lineHeight: '16px',
                            }}
                        >
                            {filtrosActivos.length}
                        </span>
                    ) : null}
                </button>
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '5px 8px',
                        lineHeight: 0,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    aria-label="Actualizar"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div style={{ padding: '20px' }}>
                <div
                    className="compras-no-imprimir"
                    style={{
                        ...glass,
                        padding: '14px 18px',
                        marginBottom: '16px',
                        border: '1px solid rgba(88,86,214,0.35)',
                    }}
                >
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 800, marginBottom: '6px' }}>
                        TASA BCV DEL DÍA · REFERENCIA EN DÓLARES
                    </p>
                    {cargandoTasaHoy ? (
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Consultando tasa…</p>
                    ) : tasaBcvHoy ? (
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>
                            {tasaBcvHoy.toLocaleString('es-VE', { maximumFractionDigits: 2 })} Bs / USD
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginLeft: '8px' }}>
                                ({tasaBcvFuente ?? 'bcv'})
                            </span>
                        </p>
                    ) : (
                        <p style={{ color: '#FF6B6B', fontSize: '12px', fontWeight: 700 }}>
                            Sin tasa BCV. Pulse BCV en recepción de mercancía o configure ci_config_nomina.
                        </p>
                    )}
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '8px', lineHeight: 1.45 }}>
                        Totales en <strong style={{ color: '#FF3B30' }}>USD</strong> y{' '}
                        <strong style={{ color: '#FFD60A' }}>Bs</strong> (tasa de la factura o del día).
                        El P.U. de cada línea se muestra en la moneda original de la factura.
                    </p>
                </div>

                {filtrosAbiertos ? (
                    <ComprasFiltrosPanel
                        valores={{
                            fuenteFiltro,
                            periodo,
                            fechaRefActiva,
                            fechaDesde,
                            fechaHasta,
                            entidadFiltro,
                            entidadFiltroEtiqueta,
                            proyectoFiltro,
                            proyectoFiltroEtiqueta,
                            proveedorFiltro,
                            rifFiltro,
                            articuloFiltro,
                            cantidadMin,
                            cantidadMax,
                            montoMinBs,
                            montoMaxBs,
                            montoMinUsd,
                            montoMaxUsd,
                            estadoLogisticaFiltro,
                            busqueda,
                            busquedaAplicada,
                        }}
                        entidades={entidades}
                        proyectos={proyectos}
                        proveedores={proveedores}
                        fuenteFiltro={fuenteFiltro}
                        periodo={periodo}
                        periodoLabel={periodoLabel}
                        onClose={() => setFiltrosAbiertos(false)}
                        onLimpiarTodos={limpiarTodosFiltros}
                        setFuenteFiltro={setFuenteFiltro}
                        setPeriodo={setPeriodo}
                        setFechaRef={setFechaRef}
                        setFechaDesde={setFechaDesde}
                        setFechaHasta={setFechaHasta}
                        setEntidadFiltro={handleEntidadFiltro}
                        setProyectoFiltro={setProyectoFiltro}
                        setProveedorFiltro={setProveedorFiltro}
                        setRifFiltro={setRifFiltro}
                        setArticuloFiltro={setArticuloFiltro}
                        setCantidadMin={setCantidadMin}
                        setCantidadMax={setCantidadMax}
                        setMontoMinBs={setMontoMinBs}
                        setMontoMaxBs={setMontoMaxBs}
                        setMontoMinUsd={setMontoMinUsd}
                        setMontoMaxUsd={setMontoMaxUsd}
                        setEstadoLogisticaFiltro={setEstadoLogisticaFiltro}
                        setBusqueda={setBusqueda}
                    />
                ) : (
                    <ComprasFiltrosActivosBar
                        chips={filtrosActivos}
                        onAbrirFiltros={() => setFiltrosAbiertos(true)}
                        onLimpiarTodos={limpiarTodosFiltros}
                        onQuitarChip={quitarFiltroChip}
                    />
                )}

                <div className="compras-cuadro-imprimible" style={{ ...glass, padding: '20px', marginBottom: '20px' }}>
                    <div className="compras-solo-imprimir" style={{ marginBottom: '16px' }}>
                        <h1 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px' }}>
                            Cuadro de compras cargadas
                        </h1>
                        <p style={{ fontSize: '11px', margin: 0, opacity: 0.75 }}>
                            Casa Inteligente · {new Date().toLocaleDateString('es-VE')}
                            {periodoLabel ? ` · ${periodoLabel}` : ''}
                            {entidadFiltro ? ` · ${entidadFiltroEtiqueta}` : ''}
                            {proyectoFiltro ? ` · ${proyectoFiltroEtiqueta}` : ''}
                            {fuenteFiltro !== 'todos' ? ` · ${fuenteFiltro}` : ''}
                        </p>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                        }}
                    >
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700, margin: 0 }}>
                            TOTAL FILTRADO ({compras.length} compra{compras.length === 1 ? '' : 's'})
                        </p>
                        {compras.length > 0 ? (
                            <div
                                className="compras-no-imprimir"
                                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => void compartirCuadro()}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(88,86,214,0.45)',
                                        background: 'rgba(88,86,214,0.2)',
                                        color: 'white',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Share2 size={14} />
                                    {compartidoOk ? 'Copiado' : 'Compartir lista'}
                                </button>
                                {lineasOrdenadas.length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={verPdfCuadro}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 12px',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(167,139,250,0.45)',
                                            background: 'rgba(139,92,246,0.2)',
                                            color: 'white',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <FileText size={14} />
                                        Ver PDF
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={imprimirCuadro}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        background: 'rgba(255,255,255,0.08)',
                                        color: 'white',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Printer size={14} />
                                    Imprimir
                                </button>
                            </div>
                        ) : null}
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '16px',
                            marginTop: '14px',
                        }}
                    >
                        <div>
                            <p
                                style={{
                                    color: 'rgba(255,255,255,0.4)',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    letterSpacing: '0.06em',
                                    marginBottom: '6px',
                                }}
                            >
                                TOTAL USD
                            </p>
                            <p style={{ color: '#FF3B30', fontSize: '26px', fontWeight: 800, margin: 0 }}>
                                {formatearUsd(totalFiltrado.totalUsd)}
                            </p>
                            <p
                                style={{
                                    color: 'rgba(255,255,255,0.35)',
                                    fontSize: '10px',
                                    marginTop: '6px',
                                    lineHeight: 1.4,
                                }}
                            >
                                Suma del equivalente en dólares de cada factura (tasa BCV de su fecha).
                            </p>
                        </div>
                        <div>
                            <p
                                style={{
                                    color: 'rgba(255,255,255,0.4)',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    letterSpacing: '0.06em',
                                    marginBottom: '6px',
                                }}
                            >
                                TOTAL BOLÍVARES
                            </p>
                            <p style={{ color: '#FFD60A', fontSize: '26px', fontWeight: 800, margin: 0 }}>
                                {formatearBs(totalFiltrado.totalBs)}
                            </p>
                            <p
                                style={{
                                    color: 'rgba(255,255,255,0.35)',
                                    fontSize: '10px',
                                    marginTop: '6px',
                                    lineHeight: 1.4,
                                }}
                            >
                                Suma directa de los montos en Bs de cada factura (sin unificar tasa).
                            </p>
                        </div>
                    </div>
                    {totalFiltrado.tasaVariable ? (
                        <p
                            style={{
                                marginTop: '14px',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                background: 'rgba(255,214,10,0.08)',
                                border: '1px solid rgba(255,214,10,0.25)',
                                color: '#FFD60A',
                                fontSize: '11px',
                                fontWeight: 700,
                                lineHeight: 1.45,
                            }}
                        >
                            Tasa BCV variable: el filtro incluye{' '}
                            {totalFiltrado.fechasDistintas > 1
                                ? `${totalFiltrado.fechasDistintas} fechas distintas`
                                : 'facturas con tasas distintas'}
                            {totalFiltrado.tasasDistintas > 1
                                ? ` y ${totalFiltrado.tasasDistintas} tasas BCV diferentes`
                                : ''}
                            . No se aplica una sola tasa del día al total; cada compra conserva la
                            tasa de su factura.
                        </p>
                    ) : totalFiltrado.tasaUnica != null ? (
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '10px' }}>
                            Tasa BCV común en el filtro: {formatearTasaBcv(totalFiltrado.tasaUnica)}
                        </p>
                    ) : null}
                    {totalFiltrado.comprasSinTasaEnFactura > 0 ? (
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '8px' }}>
                            {totalFiltrado.comprasSinTasaEnFactura} compra(s) sin tasa en factura: USD
                            calculado con BCV del día de referencia del filtro.
                        </p>
                    ) : null}
                    <Link
                        className="compras-no-imprimir"
                        href="/almacen/procurement"
                        style={{
                            display: 'inline-block',
                            marginTop: '12px',
                            color: '#5856D6',
                            fontSize: '13px',
                            fontWeight: 700,
                            textDecoration: 'none',
                        }}
                    >
                        Ir a recepción de mercancía →
                    </Link>

                {loading ? (
                    <div className="compras-no-imprimir" style={{ textAlign: 'center', marginTop: '60px', color: 'rgba(255,255,255,0.4)' }}>
                        <Loader2 className="animate-spin mx-auto mb-3" size={32} />
                        <p>Cargando compras…</p>
                    </div>
                ) : null}

                {error ? (
                    <div
                        className="compras-no-imprimir"
                        style={{
                            ...glass,
                            padding: '20px',
                            color: '#FF6B6B',
                            fontSize: '14px',
                            fontWeight: 600,
                            marginBottom: '16px',
                        }}
                    >
                        {error}
                    </div>
                ) : null}

                {avisoCanal ? (
                    <div
                        className="compras-no-imprimir"
                        style={{
                            marginTop: '12px',
                            padding: '14px',
                            borderRadius: '12px',
                            background: 'rgba(255,214,10,0.12)',
                            color: '#FFD60A',
                            fontSize: '13px',
                            fontWeight: 700,
                            lineHeight: 1.45,
                        }}
                    >
                        Facturas Telegram: {avisoCanal}
                    </div>
                ) : null}

                {!loading && compras.length === 0 && !error ? (
                    <div className="compras-no-imprimir" style={{ textAlign: 'center', marginTop: '48px', color: 'rgba(255,255,255,0.35)' }}>
                        <p style={{ fontSize: '18px', fontWeight: 700 }}>Sin compras con estos filtros</p>
                        <p style={{ fontSize: '13px', marginTop: '8px' }}>
                            Ajuste entidad, obra/proyecto, proveedor, producto, rango de fechas, RIF o montos Bs/USD.
                        </p>
                    </div>
                ) : null}

                {!loading && compras.length > 0 ? (
                    <div className="compras-no-imprimir" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button
                            type="button"
                            onClick={() => setVistaListado('lineas')}
                            style={periodBtn(vistaListado === 'lineas')}
                        >
                            Por línea / artículo
                            {lineasOrdenadas.length > 0 ? (
                                <EtiquetaBimonetariaCompra
                                    usd={totalUsdLineasVista}
                                    bs={totalLineasBs}
                                    tasa={totalFiltrado.tasaVariable ? null : totalFiltrado.tasaUnica}
                                    layout="stack"
                                    style={{ display: 'block', fontSize: 9, marginTop: 4, textTransform: 'none' }}
                                />
                            ) : null}
                        </button>
                        <button
                            type="button"
                            onClick={() => setVistaListado('facturas')}
                            style={periodBtn(vistaListado === 'facturas')}
                        >
                            Por factura
                            {compras.length > 0 ? (
                                <EtiquetaBimonetariaCompra
                                    usd={totalFiltrado.totalUsd}
                                    bs={totalFiltrado.totalBs}
                                    tasa={totalFiltrado.tasaVariable ? null : totalFiltrado.tasaUnica}
                                    layout="stack"
                                    style={{ display: 'block', fontSize: 9, marginTop: 4, textTransform: 'none' }}
                                />
                            ) : null}
                        </button>
                    </div>
                ) : null}

                {showList ? (
                    <div
                        className="compras-no-imprimir"
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '16px',
                            padding: '12px 14px',
                            borderRadius: '14px',
                            border: algunaSeleccionada
                                ? '1px solid rgba(88,86,214,0.45)'
                                : '1px solid rgba(255,255,255,0.08)',
                            background: algunaSeleccionada
                                ? 'rgba(88,86,214,0.12)'
                                : 'rgba(255,255,255,0.03)',
                        }}
                    >
                        <label
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 700,
                            }}
                        >
                            <input
                                ref={selectAllRef}
                                type="checkbox"
                                checked={todasSeleccionadas}
                                onChange={toggleSelectAll}
                                style={{ width: 16, height: 16, accentColor: '#5856D6' }}
                            />
                            {todasSeleccionadas
                                ? 'Quitar selección'
                                : `Seleccionar todas (${compras.length})`}
                        </label>
                        {algunaSeleccionada ? (
                            <>
                                <span style={{ color: '#a5a3ff', fontSize: '12px', fontWeight: 800 }}>
                                    {selectedIds.size} seleccionada(s)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void handleBulkDelete()}
                                    disabled={deletingBulk || deletingId !== null}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(255,59,48,0.35)',
                                        background: 'rgba(255,59,48,0.12)',
                                        color: '#FF6B6B',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        cursor: deletingBulk ? 'not-allowed' : 'pointer',
                                        opacity: deletingBulk ? 0.6 : 1,
                                    }}
                                >
                                    {deletingBulk ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={14} />
                                    )}
                                    Borrar seleccionadas
                                </button>
                            </>
                        ) : null}
                    </div>
                ) : null}

                <div className="compras-cuadro-pantalla">
                {!loading && vistaListado === 'lineas' && lineasOrdenadas.length > 0 ? (
                    <p
                        style={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: '12px',
                            fontWeight: 700,
                            marginBottom: '12px',
                        }}
                    >
                        Líneas filtradas:{' '}
                        <EtiquetaBimonetariaCompra
                            usd={totalUsdLineasVista}
                            bs={totalLineasBs}
                            tasa={totalFiltrado.tasaVariable ? null : totalFiltrado.tasaUnica}
                            layout="inline"
                            style={{ display: 'inline-flex', fontSize: 12 }}
                        />
                        {totalFiltrado.tasaVariable ? (
                            <span style={{ display: 'block', fontSize: 10, marginTop: 4, color: '#FFD60A' }}>
                                Tasa variable por fecha de cada factura
                            </span>
                        ) : null}
                    </p>
                ) : null}

                {!loading && vistaListado === 'lineas' && compras.length > 0 ? (
                    showLineas ? (
                        <ComprasLineasTable
                            filas={lineasOrdenadas}
                            onScrollToCompra={scrollToCompra}
                            accionesPorCompra={accionesCompra}
                            onModificar={onModificarCompra}
                            onEliminar={onEliminarCompra}
                            deletingId={deletingId}
                            sortColumn={sortColumn}
                            sortDir={sortDir}
                            onSort={onSortColumna}
                            ordenPlano={ordenPlanoTabla}
                            selectedIds={selectedIds}
                            onToggleCompra={toggleSelectCompra}
                            onToggleSelectAll={toggleSelectAll}
                            todasSeleccionadas={todasSeleccionadas}
                            selectAllIndeterminate={seleccionIndeterminada}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', marginTop: '24px', color: 'rgba(255,255,255,0.35)' }}>
                            <p style={{ fontSize: '15px', fontWeight: 700 }}>Sin líneas con estos filtros</p>
                        </div>
                    )
                ) : null}

                {showList && vistaListado === 'facturas' ? (
                    <p
                        style={{
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '11px',
                            fontWeight: 600,
                            marginBottom: '12px',
                            lineHeight: 1.45,
                        }}
                    >
                        Pulsa el nombre del proveedor para ver u ocultar la imagen de la factura.
                    </p>
                ) : null}

                {showList && vistaListado === 'facturas' ? (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {compras.map((c) => (
                            <div
                                id={`compra-card-${c.id}`}
                                key={c.id}
                                style={{
                                    ...glass,
                                    padding: '18px',
                                    border: selectedIds.has(c.id)
                                        ? '1px solid rgba(88,86,214,0.55)'
                                        : glass.border,
                                    background: selectedIds.has(c.id)
                                        ? 'rgba(88,86,214,0.1)'
                                        : glass.background,
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: '12px',
                                    }}
                                >
                                    <label
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            paddingTop: '4px',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                        }}
                                        title="Seleccionar factura"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(c.id)}
                                            onChange={() => toggleSelectCompra(c.id)}
                                            style={{ width: 16, height: 16, accentColor: '#5856D6' }}
                                        />
                                    </label>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {(() => {
                                            const puedeImagen = compraPuedeVerImagen(c);
                                            const imagenAbierta = imagenFacturaAbierta === c.id;
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (puedeImagen) toggleImagenFactura(c.id);
                                                    }}
                                                    disabled={!puedeImagen}
                                                    style={{
                                                        display: 'block',
                                                        width: '100%',
                                                        textAlign: 'left',
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: 0,
                                                        marginBottom: '4px',
                                                        cursor: puedeImagen ? 'pointer' : 'default',
                                                    }}
                                                    aria-expanded={puedeImagen ? imagenAbierta : undefined}
                                                >
                                                    <span
                                                        style={{
                                                            color: 'white',
                                                            fontSize: '17px',
                                                            fontWeight: 800,
                                                            textDecoration: puedeImagen
                                                                ? imagenAbierta
                                                                    ? 'underline'
                                                                    : 'underline dotted'
                                                                : 'none',
                                                            textDecorationColor: '#a5a3ff',
                                                        }}
                                                    >
                                                        {c.supplier_name}
                                                    </span>
                                                    {puedeImagen ? (
                                                        <span
                                                            style={{
                                                                marginLeft: '8px',
                                                                fontSize: '10px',
                                                                fontWeight: 700,
                                                                color: imagenAbierta
                                                                    ? '#a5a3ff'
                                                                    : 'rgba(255,255,255,0.35)',
                                                            }}
                                                        >
                                                            {imagenAbierta ? '▲ ocultar imagen' : '▼ ver imagen'}
                                                        </span>
                                                    ) : null}
                                                </button>
                                            );
                                        })()}
                                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                                            Factura #{c.invoice_number} · {c.supplier_rif}
                                            <span
                                                style={{
                                                    marginLeft: '8px',
                                                    fontSize: '10px',
                                                    fontWeight: 800,
                                                    color:
                                                        c.fuente_lista === 'telegram'
                                                            ? '#7dd3fc'
                                                            : '#a78bfa',
                                                }}
                                            >
                                                {etiquetaOrigenCompra(c)}
                                            </span>
                                            {c.estado_logistica && c.estado_logistica !== 'sin_documento' ? (
                                                <span
                                                    style={{
                                                        marginLeft: '8px',
                                                        fontSize: '10px',
                                                        fontWeight: 800,
                                                        padding: '2px 7px',
                                                        borderRadius: '6px',
                                                        ...coloresEstadoLogistica(c.estado_logistica),
                                                    }}
                                                >
                                                    {etiquetaEstadoLogistica(
                                                        c.estado_logistica,
                                                        c.logistica_conteos,
                                                    )}
                                                </span>
                                            ) : null}
                                        </p>
                                        {compraTieneDetallePuenteInventario(c) ? (
                                            <div
                                                style={{
                                                    marginTop: '8px',
                                                    padding: '8px 10px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(52,199,89,0.08)',
                                                    border: '1px solid rgba(52,199,89,0.22)',
                                                }}
                                            >
                                                {lineasDetallePuenteInventario(c).map((linea) => (
                                                    <p
                                                        key={linea}
                                                        style={{
                                                            margin: 0,
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            color: c.cuarentena_rechazo_total
                                                                ? '#fca5a5'
                                                                : 'rgba(134,239,172,0.95)',
                                                            lineHeight: 1.45,
                                                        }}
                                                    >
                                                        {linea}
                                                    </p>
                                                ))}
                                            </div>
                                        ) : null}
                                        {(c.entidad_nombre || c.proyecto_nombre || c.ubicacion_nombre) ? (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: '6px',
                                                    marginTop: '8px',
                                                }}
                                            >
                                                {c.entidad_nombre ? (
                                                    <span
                                                        style={{
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            padding: '4px 8px',
                                                            borderRadius: '8px',
                                                            background: 'rgba(255,255,255,0.06)',
                                                            color: 'rgba(255,255,255,0.55)',
                                                        }}
                                                    >
                                                        {c.entidad_nombre}
                                                    </span>
                                                ) : null}
                                                {c.proyecto_nombre ? (
                                                    <span
                                                        style={{
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            padding: '4px 8px',
                                                            borderRadius: '8px',
                                                            background: 'rgba(167,139,250,0.12)',
                                                            color: '#c4b5fd',
                                                        }}
                                                    >
                                                        {c.proyecto_nombre}
                                                    </span>
                                                ) : null}
                                                {c.ubicacion_nombre ? (
                                                    <span
                                                        style={{
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            padding: '4px 8px',
                                                            borderRadius: '8px',
                                                            background: 'rgba(234,88,12,0.15)',
                                                            color: '#fdba74',
                                                        }}
                                                    >
                                                        {c.ubicacion_nombre}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '8px',
                                                marginTop: '10px',
                                            }}
                                        >
                                            {puedeReubicarCompra(c) ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setReubicarCompra({
                                                            id: c.id,
                                                            entidadId: c.entidad_id,
                                                            proyectoId: c.proyecto_id,
                                                            ubicacionId: c.ubicacion_destino_id,
                                                            titulo: `Reubicar — ${c.supplier_name}`,
                                                        })
                                                    }
                                                    disabled={deletingId !== null || deletingBulk}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        borderRadius: '10px',
                                                        border: '1px solid rgba(251,146,60,0.45)',
                                                        background: 'rgba(234,88,12,0.15)',
                                                        color: '#fdba74',
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <MapPin size={14} />
                                                    Obra / almacén
                                                </button>
                                            ) : null}
                                            {c.purchase_invoice_id &&
                                            compraPermiteIngresoAlmacen(c.estado_logistica) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleIngresoAlmacen(c)}
                                                    disabled={deletingId !== null || ingresandoAlmacenId !== null}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        borderRadius: '10px',
                                                        border:
                                                            c.estado_logistica === 'cuarentena' ||
                                                            c.estado_logistica === 'en_almacen_parcial'
                                                                ? '1px solid rgba(245,158,11,0.45)'
                                                                : '1px solid rgba(52,199,89,0.45)',
                                                        background:
                                                            c.estado_logistica === 'cuarentena' ||
                                                            c.estado_logistica === 'en_almacen_parcial'
                                                                ? 'rgba(245,158,11,0.14)'
                                                                : 'rgba(52,199,89,0.14)',
                                                        color:
                                                            c.estado_logistica === 'cuarentena' ||
                                                            c.estado_logistica === 'en_almacen_parcial'
                                                                ? '#fcd34d'
                                                                : '#86efac',
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                        opacity: ingresandoAlmacenId === c.id ? 0.6 : 1,
                                                    }}
                                                >
                                                    {ingresandoAlmacenId === c.id ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <PackageCheck size={14} />
                                                    )}
                                                    {c.estado_logistica === 'en_almacen_parcial'
                                                        ? 'Liberar pendiente'
                                                        : c.estado_logistica === 'cuarentena'
                                                          ? 'Liberar cuarentena'
                                                          : 'Ingreso a almacén'}
                                                </button>
                                            ) : null}
                                            {c.pendiente_canal_id ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void abrirEditarTelegram(c)}
                                                    disabled={deletingId !== null || deletingBulk}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        borderRadius: '10px',
                                                        border: '1px solid rgba(56,189,248,0.4)',
                                                        background: 'rgba(14,116,144,0.25)',
                                                        color: '#7dd3fc',
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <Pencil size={14} />
                                                    Modificar
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => void handleDelete(c)}
                                                disabled={deletingId !== null || deletingBulk}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '8px 12px',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(255,59,48,0.35)',
                                                    background: 'rgba(255,59,48,0.12)',
                                                    color: '#FF6B6B',
                                                    fontSize: '11px',
                                                    fontWeight: 800,
                                                    cursor: deletingId ? 'not-allowed' : 'pointer',
                                                    opacity: deletingId === c.id ? 0.6 : 1,
                                                }}
                                            >
                                                {deletingId === c.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                                Borrar
                                            </button>
                                        </div>
                                        {c.mensaje_error_canal ? (
                                            <p style={{ color: '#FF6B6B', fontSize: '11px', marginTop: '6px' }}>
                                                {c.mensaje_error_canal}
                                            </p>
                                        ) : null}
                                        <p
                                            style={{
                                                color: 'rgba(255,255,255,0.35)',
                                                fontSize: '11px',
                                                marginTop: '8px',
                                            }}
                                        >
                                            {c.fecha}
                                            {(() => {
                                                const tasa = tasaDisplayCompra(c);
                                                return tasa != null
                                                    ? ` · Tasa ${formatearTasaBcv(tasa)}${
                                                          !tasaBcvCompra(c) && tasaParaCompra(c)
                                                              ? ' (BCV fecha factura)'
                                                              : ''
                                                      }`
                                                    : '';
                                            })()}{' '}
                                            · {lineCount(c)} producto(s)
                                        </p>
                                        {!c.pendiente_canal_id ? (
                                            <CompraProductosToggle
                                                compraId={c.id}
                                                tasaBcv={tasaDisplayCompra(c)}
                                                tasaEsDelDia={!tasaBcvCompra(c) && !!tasaParaCompra(c)}
                                                montoBsFactura={montoVesCompra(c)}
                                                montoUsdFactura={
                                                    vesAUsdConTasa(montoVesCompra(c), tasaDisplayCompra(c)) ??
                                                    montoUsdCompra(c)
                                                }
                                                lineCountHint={lineCount(c)}
                                                lineasIniciales={lineasDetalle(c).map((l) => ({
                                                    descripcion: l.descripcion,
                                                    item_code: l.item_code,
                                                    subtotal: l.subtotal,
                                                    cantidad: l.cantidad,
                                                    unidad: null,
                                                    precio_unitario:
                                                        l.cantidad > 0 ? l.subtotal / l.cantidad : null,
                                                }))}
                                            />
                                        ) : lineCount(c) > 0 ? (
                                            <p
                                                style={{
                                                    marginTop: '8px',
                                                    fontSize: '11px',
                                                    color: 'rgba(255,255,255,0.45)',
                                                }}
                                            >
                                                {lineCount(c)} línea(s) extraída(s) por IA
                                            </p>
                                        ) : null}
                                        {compraPuedeVerImagen(c) ? (
                                            <CompraFacturaImagen
                                                compraId={c.id}
                                                documentApiPath={
                                                    c.pendiente_canal_id &&
                                                    (c.id.startsWith('canal-') ||
                                                        !c.purchase_invoice_id)
                                                        ? `/api/facturas-canal/pendientes/${c.pendiente_canal_id}/document`
                                                        : undefined
                                                }
                                                expanded={imagenFacturaAbierta === c.id}
                                                tieneDocumento={
                                                    Boolean(
                                                        c.document_storage_path ||
                                                            c.purchase_invoice_id ||
                                                            c.pendiente_canal_id,
                                                    )
                                                }
                                                esRecepcion={
                                                    c.origen === 'RECEPCION_MERCANCIA' ||
                                                    c.origen === 'TELEGRAM'
                                                }
                                            />
                                        ) : c.document_file_name ? (
                                            <p
                                                style={{
                                                    marginTop: '8px',
                                                    fontSize: '11px',
                                                    color: 'rgba(255,255,255,0.4)',
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                Archivo «{c.document_file_name}» registrado sin imagen en
                                                Storage. Adjúntala en{' '}
                                                <Link
                                                    href="/almacen/procurement"
                                                    style={{ color: '#5856D6', fontWeight: 700 }}
                                                >
                                                    recepción de mercancía
                                                </Link>
                                                .
                                            </p>
                                        ) : null}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        {(() => {
                                            const tasaDisp = tasaDisplayCompra(c);
                                            const montos = montosBimonetariosLista(c, tasaDisp);
                                            return (
                                                <>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'flex-end',
                                                            gap: '6px',
                                                            marginBottom: '6px',
                                                        }}
                                                    >
                                                        <label
                                                            htmlFor={`moneda-${c.id}`}
                                                            style={{
                                                                fontSize: '10px',
                                                                fontWeight: 700,
                                                                color: 'rgba(255,255,255,0.4)',
                                                                textTransform: 'uppercase',
                                                            }}
                                                        >
                                                            Moneda
                                                        </label>
                                                        <select
                                                            id={`moneda-${c.id}`}
                                                            value={monedaOriginalCompra(c)}
                                                            disabled={
                                                                cambiandoMonedaId === c.id ||
                                                                deletingId !== null ||
                                                                deletingBulk
                                                            }
                                                            onChange={(e) =>
                                                                void cambiarMonedaCompra(
                                                                    c,
                                                                    normalizarMonedaExtracted(
                                                                        e.target.value,
                                                                    ),
                                                                )
                                                            }
                                                            style={{
                                                                borderRadius: '8px',
                                                                border: '1px solid rgba(255,255,255,0.12)',
                                                                background: '#0A0A0F',
                                                                color: '#f4f4f5',
                                                                fontSize: '11px',
                                                                fontWeight: 800,
                                                                padding: '4px 8px',
                                                                cursor: 'pointer',
                                                                opacity:
                                                                    cambiandoMonedaId === c.id
                                                                        ? 0.55
                                                                        : 1,
                                                            }}
                                                        >
                                                            <option value="VES">Bs</option>
                                                            <option value="USD">USD</option>
                                                        </select>
                                                        {cambiandoMonedaId === c.id ? (
                                                            <Loader2
                                                                size={14}
                                                                className="animate-spin text-zinc-400"
                                                            />
                                                        ) : null}
                                                    </div>
                                                    <EtiquetaBimonetariaCompra
                                                        usd={montos.usd}
                                                        bs={montos.bs}
                                                        tasa={tasaDisp}
                                                        tasaEsDelDia={
                                                            !tasaBcvCompra(c) && !!tasaParaCompra(c)
                                                        }
                                                        layout="stack"
                                                        style={{
                                                            alignItems: 'flex-end',
                                                            fontSize: 18,
                                                        }}
                                                    />
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
                </div>

                {!loading && lineasOrdenadas.length > 0 ? (
                    <div className="compras-cuadro-print-tabla" style={{ marginTop: '20px' }}>
                        <p
                            style={{
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '12px',
                                fontWeight: 700,
                                marginBottom: '12px',
                            }}
                        >
                            Detalle por línea / artículo
                        </p>
                        <ComprasLineasTable filas={lineasOrdenadas} />
                    </div>
                ) : null}
                </div>
            </div>

            <EditarFacturaCanalModal
                open={editandoCanal != null}
                extracted={editandoCanal?.extracted ?? null}
                onClose={() => setEditandoCanal(null)}
                onGuardar={guardarEdicionTelegram}
            />

            <ReubicarCompraModal
                open={reubicarCompra != null}
                compraId={reubicarCompra?.id ?? ''}
                titulo={reubicarCompra?.titulo}
                entidadIdInicial={reubicarCompra?.entidadId}
                proyectoIdInicial={reubicarCompra?.proyectoId}
                ubicacionIdInicial={reubicarCompra?.ubicacionId}
                onClose={() => setReubicarCompra(null)}
                onGuardado={() => void load()}
            />
        </div>
    );
}
