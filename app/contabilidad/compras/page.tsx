'use client';

import { EntidadConNombre, SELECT_NOMBRE_ENTIDAD, conNombreEntidad, conNombreFila, nombreEntidad } from '@/lib/entidades/nombreEntidad';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDeleteCompraError } from '@/lib/contabilidad/deleteCompraRegistro';
import { useUmbralesFechaCompras } from '@/lib/alertas/useUmbralesFechaCompras';
import {
    metaAlertaFechaCompra,
} from '@/lib/contabilidad/auditoriaFechaCompra';
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
} from '@/lib/contabilidad/filtrosFacturaCanal';
import ComprasLineasTable from '@/components/contabilidad/ComprasLineasTable';
import ComprasFacturasTable from '@/components/contabilidad/ComprasFacturasTable';
import ComprasFiltrosPanel, {
    buildComprasFiltrosChips,
    ComprasFiltrosActivosBar,
    ComprasFiltrosSeleccionObra,
    type EntidadOpcion,
} from '@/components/contabilidad/ComprasFiltrosPanel';
import {
    loadCatalogoProyectosApp,
    mergeProyectosCatalogo,
    type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import {
    Download,
    Filter,
    FileText,
    FileSpreadsheet,
    FileUp,
    Loader2,
    Printer,
    RefreshCw,
    Search,
    Share2,
    Trash2,
} from 'lucide-react';
import CargarFacturaCuadroModal from '@/components/contabilidad/CargarFacturaCuadroModal';
import ReubicarCompraModal from '@/components/contabilidad/ReubicarCompraModal';
import { esGastoEntidadImputacion } from '@/lib/contabilidad/imputacionCompra';
import VerificarFechaCompraModal from '@/components/contabilidad/VerificarFechaCompraModal';
import ReporteClienteComprasModal from '@/components/contabilidad/ReporteClienteComprasModal';
import { buildReporteClienteDesdeCompras } from '@/lib/contabilidad/reporteClienteCompras';
import EditarFacturaCanalModal, {
    type DestinoCompraEdicion,
    type GuardarFacturaCanalOpts,
} from '@/components/contabilidad/EditarFacturaCanalModal';
import EditarLineaCompraModal, {
    type LineaCompraEditable,
} from '@/components/contabilidad/EditarLineaCompraModal';
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
import { useTasasBcvPorFechas } from '@/lib/contabilidad/useTasasBcvPorFechas';
import { tasaBcvPorFechaCompra } from '@/lib/contabilidad/tasaBcvPorFechaCompra';
import { cargarCanalParaCompras } from '@/lib/contabilidad/cargarCanalParaCompras';
import {
    extractedDesdeCompraLista,
    normalizarMonedaExtracted,
    type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import {
    actualizarPendienteCanal,
    eliminarPendienteCanal,
    rutaDocumentoPendienteCanal,
} from '@/lib/contabilidad/facturaCanalApi';
import { reubicarCompra as reubicarCompraApi } from '@/lib/contabilidad/reubicarCompraApi';
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
import { enriquecerComprasRecepcionCampo } from '@/lib/contabilidad/enriquecerComprasRecepcionCampo';
import {
    enriquecerComprasEstadoLogistica,
    type EstadoLogisticaCompra,
} from '@/lib/contabilidad/estadoLogisticaCompra';
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
  esCompraSoloAuditoriaCco,
  esDescripcionAuditoriaCco,
  esProveedorActorBitacoraCco,
} from '@/lib/contabilidad/compraEsAuditoriaCco';
import { recalcularPreciosLineasCompra } from '@/lib/contabilidad/filtrosFacturaCanal';
import type { FilaFacturaCanal } from '@/lib/contabilidad/filtrosFacturaCanal';
import { etiquetaRifCompra } from '@/lib/contabilidad/rifVenezolano';
import {
    buildLineasCuadroDesdeCompras,
    exportarComprasCuadroExcel,
    type ComprasExportScope,
} from '@/lib/contabilidad/comprasExportShare';
import {
    lineasComprasATsv,
    ordenarLineasCompras,
    type ColumnaOrdenCompras,
    type DireccionOrden,
} from '@/lib/contabilidad/ordenarLineasCompras';
import { redirigirALoginSi401 } from '@/lib/auth/loginRedirect';
import {
    monedaOriginalCompra,
    montosBimonetariosLista,
    recalcularMontosCompraCambioMoneda,
    subtotalBsLineaCompra,
    subtotalUsdLineaCompra,
} from '@/lib/contabilidad/monedaCompra';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';

type CompraRow = CompraListaUnificada;

type LineaDetalle = {
    id?: string;
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

function lineasParaProductosToggle(row: CompraRow) {
    // No mostrar logs de bitácora CCO (p. ej. «cambio proyecto:…») al expandir.
    return lineasDetalle(row)
        .filter((l) => !esDescripcionAuditoriaCco(l.descripcion))
        .map((l) => ({
            descripcion: l.descripcion,
            item_code: l.item_code,
            subtotal: l.subtotal,
            cantidad: l.cantidad,
            unidad: null,
            precio_unitario:
                l.precio_unitario ?? (l.cantidad > 0 ? l.subtotal / l.cantidad : null),
        }));
}

type PurchaseInvoiceEmbed = {
    proyecto_id?: string | null;
    entidad_id?: string | null;
    ubicacion_destino_id?: string | null;
    dias_credito?: number | null;
    fecha_vencimiento?: string | null;
    condicion_pago?: string | null;
};

function aplicarEmbedFactura(
    r: CompraRow & { purchase_invoice?: PurchaseInvoiceEmbed | null; notas?: string | null },
): CompraRow {
    const pi = r.purchase_invoice;
    return {
        ...r,
        fuente_lista: r.fuente_lista ?? 'app',
        proyecto_id: r.proyecto_id ?? pi?.proyecto_id ?? null,
        entidad_id: r.entidad_id ?? pi?.entidad_id ?? null,
        ubicacion_destino_id: r.ubicacion_destino_id ?? pi?.ubicacion_destino_id ?? null,
        notas: r.notas ?? null,
        dias_credito: r.dias_credito ?? pi?.dias_credito ?? null,
        fecha_vencimiento: r.fecha_vencimiento ?? pi?.fecha_vencimiento ?? null,
        condicion_pago: r.condicion_pago ?? pi?.condicion_pago ?? null,
    };
}

function destinoEdicionDesdeCompra(c: CompraRow): DestinoCompraEdicion | null {
    if (esGastoEntidadImputacion(c.imputacion)) return null;
    return {
        compraId: c.id,
        imputacion: c.imputacion ?? 'obra',
        entidadId: c.entidad_id ?? null,
        proyectoId: c.proyecto_id ?? null,
        ubicacionId: c.ubicacion_destino_id ?? null,
    };
}

export default function ComprasPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const umbralesFecha = useUmbralesFechaCompras();
    const [compras, setCompras] = useState<CompraRow[]>([]);
    /** Compras del periodo/carga sin filtros de obra, proveedor, logística, etc. (exportación «completo»). */
    const [comprasCuadroBase, setComprasCuadroBase] = useState<CompraRow[]>([]);
    const [exportScope, setExportScope] = useState<ComprasExportScope>('filtrado');
    const [reporteClienteAbierto, setReporteClienteAbierto] = useState(false);
    const [proyectos, setProyectos] = useState<ProyectoOpcion[]>([]);
    const [entidades, setEntidades] = useState<EntidadOpcion[]>([]);
    const [proveedores, setProveedores] = useState<ProveedorOpcion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [avisoCanal, setAvisoCanal] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deletingLineaId, setDeletingLineaId] = useState<string | null>(null);
    const [deletingLineasBulk, setDeletingLineasBulk] = useState(false);
    const [selectedLineaIds, setSelectedLineaIds] = useState<Set<string>>(new Set());
    const [editandoLinea, setEditandoLinea] = useState<LineaCompraEditable | null>(null);
    const [ingresandoAlmacenId, setIngresandoAlmacenId] = useState<string | null>(null);
    const [cambiandoMonedaId, setCambiandoMonedaId] = useState<string | null>(null);
    const [editandoCanal, setEditandoCanal] = useState<{
        pendienteId: string;
        compraId: string | null;
        extracted: ExtractedCanalHeader;
        destino: DestinoCompraEdicion | null;
        /** updated_at de la factura al abrirla: el servidor rechaza si cambió. */
        versionPendiente?: string | null;
    } | null>(null);
    const [reubicarCompra, setReubicarCompra] = useState<{
        id: string;
        entidadId?: string | null;
        proyectoId?: string | null;
        ubicacionId?: string | null;
        titulo?: string;
    } | null>(null);
    const [cargarFacturaOpen, setCargarFacturaOpen] = useState(false);
    /** Incrementar tras importar CSV para forzar reload aunque los filtros no cambien. */
    const [comprasReloadToken, setComprasReloadToken] = useState(0);
    const [verificandoFecha, setVerificandoFecha] = useState<{
        compraId: string;
        pendienteCanalId?: string | null;
        esCanalSolo?: boolean;
        fechaFactura: string;
        fechaRegistro?: string | null;
        tasaBcv?: number | null;
        proveedor?: string;
        factura?: string;
        nivelAlerta: 'advertencia' | 'critico';
        mensajeAuditoria: string;
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
    const compraDeepLinkHandled = useRef(false);

    const compraDeepLinkId = searchParams.get('compra')?.trim() || null;

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

        if (compraDeepLinkId) {
            setPeriodo('todas');
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
            setBusqueda('');
            setBusquedaAplicada('');
            setFuenteFiltro('todos');
            setEstadoLogisticaFiltro('');
            setVistaListado('facturas');
        }

        filtrosPersistenciaLista.current = true;
    }, [hydrated, searchParams, aplicarFiltrosCuadro, compraDeepLinkId]);

    const fechaRefActiva = fechaRef || (hydrated ? todayIso() : '');

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
                .select('supplier_name, supplier_rif, invoice_number')
                .order('supplier_name')
                .limit(800);
            if (data?.length) {
                const limpios = (
                    data as {
                        supplier_name: string;
                        supplier_rif: string;
                        invoice_number?: string | null;
                    }[]
                ).filter(
                    (r) =>
                        !esProveedorActorBitacoraCco({
                            supplier_name: r.supplier_name,
                            supplier_rif: r.supplier_rif,
                            invoice_number: r.invoice_number,
                        }),
                );
                setProveedores(dedupeProveedores(limpios));
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
                .select(SELECT_NOMBRE_ENTIDAD)
                .limit(300);
            if (data?.length) {
                setEntidades(
                    (data as (EntidadConNombre & { id: string })[]).map((e) => ({
                        id: e.id,
                        // Usa el nombre del cliente cuando la entidad es cliente_administrada.
                        nombre: nombreEntidad(e),
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
                'contabilidad_compra_lineas(id,descripcion,item_code,subtotal,cantidad,precio_unitario)';

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

            const selectCompraBase =
                'id,purchase_invoice_id,proyecto_id,entidad_id,imputacion,ubicacion_destino_id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,total_amount_usd,tasa_bcv_ves_por_usd,moneda,moneda_original,monto_ves,monto_usd,origen,estado,notas,document_file_name,document_storage_path,created_at';
            const selectAuditoriaFecha = ',alerta_fecha,fecha_confirmada_manual';
            const selectClasificacionEntidad = ',clasificacion_gasto_entidad';

            const buildComprasQuery = (
                conPuenteInventario = true,
                conAuditoriaFecha = true,
                conClasificacionEntidad = true,
            ) => {
                const camposPuente = conPuenteInventario ? `,${selectLogistica}` : '';
                const camposAuditoria = conAuditoriaFecha ? selectAuditoriaFecha : '';
                const camposClasificacion = conClasificacionEntidad ? selectClasificacionEntidad : '';
                let q = supabase
                    .from('contabilidad_compras')
                    .select(
                        `${selectCompraBase}${camposAuditoria}${camposClasificacion},ci_proyectos(nombre),purchase_invoice:purchase_invoices(proyecto_id,entidad_id,ubicacion_destino_id,dias_credito,fecha_vencimiento,condicion_pago)${camposPuente},${lineasSelect}`
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
                    const retry = await buildComprasQuery(false, true).limit(limiteCompras);
                    data = retry.data;
                    qErr = retry.error;
                }
                if (
                    qErr &&
                    /alerta_fecha|fecha_confirmada_manual/i.test(qErr.message ?? '')
                ) {
                    const retry = await buildComprasQuery(true, false, true).limit(limiteCompras);
                    data = retry.data;
                    qErr = retry.error;
                }
                if (
                    qErr &&
                    /clasificacion_gasto_entidad/i.test(qErr.message ?? '')
                ) {
                    const retry = await buildComprasQuery(true, true, false).limit(limiteCompras);
                    data = retry.data;
                    qErr = retry.error;
                }
                if (qErr) {
                    const msg = qErr.message ?? '';
                    if (
                        msg.includes('contabilidad_compras') ||
                        msg.includes('does not exist') ||
                        msg.includes('proyecto_id') ||
                        msg.includes('imputacion') ||
                        msg.includes('entidad_id') ||
                        msg.includes('42703') ||
                        /schema cache/i.test(msg)
                    ) {
                        throw new Error(
                            'Tabla de compras incompleta. En Supabase SQL Editor ejecute la migración ' +
                                '220_repair_contabilidad_compras.sql (o 138 + 183 + 196 + 202 + 219) y luego: notify pgrst, \'reload schema\';'
                        );
                    }
                    throw qErr;
                }
                filas = (data ?? []).map((row) =>
                    aplicarEmbedFactura(row as unknown as CompraRow & { purchase_invoice?: PurchaseInvoiceEmbed | null }),
                );
            }

            if (compraDeepLinkId && !filas.some((f) => f.id === compraDeepLinkId)) {
                let extraRow: unknown = null;
                let extraErr: { message?: string } | null = null;
                const primera = await supabase
                    .from('contabilidad_compras')
                    .select(
                        `${selectCompraBase}${selectAuditoriaFecha}${selectClasificacionEntidad},ci_proyectos(nombre),purchase_invoice:purchase_invoices(proyecto_id,entidad_id,ubicacion_destino_id,dias_credito,fecha_vencimiento,condicion_pago),${selectLogistica},${lineasSelect}`,
                    )
                    .eq('id', compraDeepLinkId)
                    .maybeSingle();
                extraRow = primera.data;
                extraErr = primera.error;
                if (
                    extraErr &&
                    /compra_factura_id|ingresado_almacen_at|cuarentena_rechazo_total|compra_factura|42703|schema cache/i.test(
                        extraErr.message ?? '',
                    )
                ) {
                    const retry = await supabase
                        .from('contabilidad_compras')
                        .select(
                            `${selectCompraBase}${selectAuditoriaFecha}${selectClasificacionEntidad},ci_proyectos(nombre),purchase_invoice:purchase_invoices(proyecto_id,entidad_id,ubicacion_destino_id,dias_credito,fecha_vencimiento,condicion_pago),${lineasSelect}`,
                        )
                        .eq('id', compraDeepLinkId)
                        .maybeSingle();
                    extraRow = retry.data;
                    extraErr = retry.error;
                }
                if (
                    extraErr &&
                    /alerta_fecha|fecha_confirmada_manual/i.test(extraErr.message ?? '')
                ) {
                    const retry = await supabase
                        .from('contabilidad_compras')
                        .select(
                            `${selectCompraBase},ci_proyectos(nombre),purchase_invoice:purchase_invoices(proyecto_id,entidad_id,ubicacion_destino_id,dias_credito,fecha_vencimiento,condicion_pago),${selectLogistica},${lineasSelect}`,
                        )
                        .eq('id', compraDeepLinkId)
                        .maybeSingle();
                    extraRow = retry.data;
                    extraErr = retry.error;
                }
                if (!extraErr && extraRow) {
                    filas = [
                        aplicarEmbedFactura(
                            extraRow as unknown as CompraRow & { purchase_invoice?: PurchaseInvoiceEmbed | null },
                        ),
                        ...filas,
                    ];
                }
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

            filas = await enriquecerComprasPuenteInventario(supabase, filas);
            filas = await enriquecerComprasRecepcionCampo(supabase, filas);
            filas = await enriquecerComprasConDestino(supabase, filas);
            filas = await enriquecerComprasEstadoLogistica(supabase, filas);

            // Si el embed de líneas vino vacío (PRODUCTOS se carga al expandir),
            // hidratar candidatos SIN-*/HISTORICO antes de filtrar bitácora CCO.
            {
                const idsFaltanLineas = filas
                    .filter((c) => {
                        if (c.id.startsWith('canal-')) return false;
                        if (lineasDetalle(c).length > 0) return false;
                        const inv = String(c.invoice_number ?? '')
                            .trim()
                            .toUpperCase();
                        const origen = String(c.origen ?? '');
                        return (
                            inv.startsWith('SIN-') ||
                            /HISTORICO_TABLA|cco_/i.test(origen) ||
                            lineCount(c) > 0
                        );
                    })
                    .map((c) => c.id);
                if (idsFaltanLineas.length > 0) {
                    const porCompra = new Map<string, LineaDetalle[]>();
                    for (let i = 0; i < idsFaltanLineas.length; i += 80) {
                        const chunk = idsFaltanLineas.slice(i, i + 80);
                        const { data: lineasExtra } = await supabase
                            .from('contabilidad_compra_lineas')
                            .select(
                                'compra_id,id,descripcion,item_code,subtotal,cantidad,precio_unitario',
                            )
                            .in('compra_id', chunk);
                        for (const raw of lineasExtra ?? []) {
                            const row = raw as {
                                compra_id: string;
                                id?: string;
                                descripcion?: string | null;
                                item_code?: string | null;
                                subtotal?: number | null;
                                cantidad?: number | null;
                                precio_unitario?: number | null;
                            };
                            const cid = String(row.compra_id);
                            const lista = porCompra.get(cid) ?? [];
                            lista.push({
                                id: row.id,
                                descripcion: String(row.descripcion ?? ''),
                                item_code: row.item_code != null ? String(row.item_code) : null,
                                subtotal: Number(row.subtotal) || 0,
                                cantidad: Number(row.cantidad) || 0,
                                precio_unitario:
                                    row.precio_unitario != null
                                        ? Number(row.precio_unitario)
                                        : undefined,
                            });
                            porCompra.set(cid, lista);
                        }
                    }
                    if (porCompra.size > 0) {
                        filas = filas.map((c) => {
                            const extra = porCompra.get(c.id);
                            if (!extra?.length) return c;
                            return { ...c, contabilidad_compra_lineas: extra };
                        });
                    }
                }
            }

            // Excluir siempre logs de auditoría CCO (artículos/sesión/PDF/respaldo, no compras).
            filas = filas.filter(
                (c) =>
                    !esCompraSoloAuditoriaCco({
                        supplier_name: c.supplier_name,
                        supplier_rif: c.supplier_rif,
                        invoice_number: c.invoice_number,
                        origen: c.origen,
                        monto_usd: c.monto_usd ?? c.total_amount_usd,
                        total_amount: c.total_amount,
                        notas: (c as { notas?: string | null }).notas ?? null,
                        lineas: lineasDetalle(c),
                    }),
            );
            setComprasCuadroBase(filas);

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

            const filtrosDestino = {
                entidadFiltro,
                proyectoFiltro,
                proveedorFiltro,
                fechaDesde: periodo !== 'todas' ? rangoActivo?.desde : undefined,
                fechaHasta: periodo !== 'todas' ? rangoActivo?.hasta : undefined,
            };
            filas = filas.filter((c) => compraCumpleFiltrosDestino(c, filtrosDestino));

            if (estadoLogisticaFiltro) {
                filas = filas.filter((c) => c.estado_logistica === estadoLogisticaFiltro);
            }

            setCompras(filas);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudieron cargar las compras.');
            setCompras([]);
            setComprasCuadroBase([]);
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
        compraDeepLinkId,
        comprasReloadToken,
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
            const data = (await res.json()) as {
                extracted?: ExtractedCanalHeader | null;
                updated_at?: string | null;
                error?: string;
            };
            if (res.ok && data.extracted) {
                setEditandoCanal({
                    pendienteId: canalId,
                    compraId: c.id.startsWith('canal-') ? null : c.id,
                    extracted: data.extracted,
                    destino: destinoEdicionDesdeCompra(c),
                    versionPendiente: typeof data.updated_at === 'string' ? data.updated_at : null,
                });
                return;
            }
        } catch {
            /* usar datos de la fila */
        }
        setEditandoCanal({
            pendienteId: canalId,
            compraId: c.id.startsWith('canal-') ? null : c.id,
            destino: destinoEdicionDesdeCompra(c),
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

    const guardarEdicionTelegram = async (
        extracted: ExtractedCanalHeader,
        opts?: GuardarFacturaCanalOpts,
    ) => {
        if (!editandoCanal) return;
        setError(null);

        if (editandoCanal.compraId) {
            const res = await fetch(`/api/contabilidad/compras/${editandoCanal.compraId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    extracted,
                    confirmar_fecha_anomala: Boolean(opts?.confirmarFechaAnomala),
                    pendiente_canal_id: editandoCanal.pendienteId,
                    pendiente_updated_at: opts?.expectedUpdatedAt ?? null,
                }),
            });
            const data = (await res.json()) as { error?: string; requiere_confirmacion?: boolean };
            if (!res.ok) {
                throw new Error(data.error ?? 'No se pudo actualizar la compra');
            }
        } else {
            await actualizarPendienteCanal(editandoCanal.pendienteId, {
                extracted,
                mensaje_error: null,
                expected_updated_at: opts?.expectedUpdatedAt ?? null,
            });
        }

        if (opts?.destino && editandoCanal.destino) {
            const ini = editandoCanal.destino;
            const d = opts.destino;
            const changed =
                d.proyecto_id !== String(ini.proyectoId ?? '').trim() ||
                d.ubicacion_destino_id !== String(ini.ubicacionId ?? '').trim() ||
                String(d.entidad_id ?? '').trim() !== String(ini.entidadId ?? '').trim();
            if (changed) {
                await reubicarCompraApi(ini.compraId, d);
            }
        }

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
            const fechaCompra = String(c.fecha ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);

            if (esSoloCanal && canalId) {
                const montosNuevos = await recalcularMontosCompraCambioMoneda(
                    {
                        total_amount: Number(c.total_amount) || 0,
                        total_amount_usd: c.total_amount_usd,
                        tasa_bcv_ves_por_usd: c.tasa_bcv_ves_por_usd,
                        moneda: c.moneda,
                        moneda_original: c.moneda_original,
                        monto_ves: c.monto_ves,
                        monto_usd: c.monto_usd,
                        fecha: fechaCompra,
                    },
                    moneda,
                );
                const { nominalFactura, ...payloadMoneda } = montosNuevos;
                const filaTrasMoneda = { ...c, ...payloadMoneda };
                const tasaTrasMoneda =
                    payloadMoneda.tasa_bcv_ves_por_usd ??
                    tasaBcvCompra(filaTrasMoneda) ??
                    tasaParaCompra(c);
                const detalleActual = lineasDetalle(c);
                const lineasRecalculadas =
                    detalleActual.length > 0
                        ? detalleActual.map((l, i) => {
                              const r = recalcularPreciosLineasCompra(
                                  filaTrasMoneda,
                                  detalleActual,
                                  tasaTrasMoneda,
                              )[i];
                              return {
                                  ...l,
                                  precio_unitario: r?.precio_unitario ?? l.precio_unitario,
                                  subtotal: r?.subtotal ?? l.subtotal,
                              };
                          })
                        : [];

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
                        contabilidad_compra_lineas: lineasRecalculadas,
                    });
                await actualizarPendienteCanal(canalId, {
                    extracted: {
                        ...base,
                        moneda,
                        total_amount: nominalFactura,
                        items: base.items?.map((it, i) => ({
                            ...it,
                            unit_price: lineasRecalculadas[i]?.precio_unitario ?? it.unit_price,
                        })),
                    },
                });
                setCompras((prev) =>
                    prev.map((row) =>
                        row.id === c.id
                            ? {
                                  ...row,
                                  ...payloadMoneda,
                                  contabilidad_compra_lineas: lineasRecalculadas.length
                                      ? lineasRecalculadas
                                      : row.contabilidad_compra_lineas,
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
                if (redirigirALoginSi401(res, '/contabilidad/compras')) return;
                const data = (await res.json()) as {
                    error?: string;
                    compra?: Partial<CompraRow>;
                };
                if (!res.ok) throw new Error(data.error || 'No se pudo cambiar la moneda');
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
            setError('Todas las líneas fueron rechazadas en tránsito. Revise la compra contable.');
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
            const estadoTrasIngreso =
                (data as { estadoLogistica?: EstadoLogisticaCompra }).estadoLogistica ??
                (data.yaExistia || !data.viaCuarentena ? 'en_almacen' : 'en_almacen_parcial');
            const ingresadoAt = new Date().toISOString();
            const patchIngreso = (row: CompraRow): CompraRow =>
                row.id === c.id
                    ? {
                          ...row,
                          estado_logistica: estadoTrasIngreso,
                          ingresado_almacen_at: row.ingresado_almacen_at ?? ingresadoAt,
                      }
                    : row;
            setCompras((prev) => prev.map(patchIngreso));
            setComprasCuadroBase((prev) => prev.map(patchIngreso));
            if (data.yaExistia) {
                setError('Esta compra ya tenía ingreso registrado en almacén.');
            } else if (data.viaCuarentena) {
                setError(
                    data.aprobadas
                        ? `Tránsito liberado: ${data.aprobadas} línea(s) ingresadas al almacén.`
                        : 'Material recibido en almacén (tránsito liberado).',
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
            entidadId: entidadFiltro || undefined,
            proyectoId: proyectoFiltro || undefined,
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
            entidadFiltro,
            proyectoFiltro,
            cantidadMin,
            cantidadMax,
            montoMinBs,
            montoMaxBs,
            montoMinUsd,
            montoMaxUsd,
        ],
    );

    const filtrosLineasSoloFecha = useMemo(
        () => ({
            fechaDesde: fuenteFiltro === 'telegram' ? '' : (rangoActivo?.desde ?? ''),
            fechaHasta: fuenteFiltro === 'telegram' ? '' : (rangoActivo?.hasta ?? ''),
        }),
        [fuenteFiltro, rangoActivo],
    );

    const lineasFiltradas = useMemo(
        () => buildLineasCuadroDesdeCompras(compras, tasaParaCompra, filtrosLineas),
        [compras, filtrosLineas, tasaParaCompra],
    );

    const lineasCuadroCompleto = useMemo(
        () => buildLineasCuadroDesdeCompras(comprasCuadroBase, tasaParaCompra, filtrosLineasSoloFecha),
        [comprasCuadroBase, filtrosLineasSoloFecha, tasaParaCompra],
    );

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

    /** Totales solo de líneas del artículo filtrado (no del total de factura). */
    const resumenArticuloFiltrado = useMemo(() => {
        const term = articuloFiltro.trim();
        if (!term) return null;
        const lineas = lineasOrdenadas.filter((r) => r.esLinea);
        const unidades = lineas.reduce((acc, r) => acc + (Number(r.cantidad) || 0), 0);
        return {
            termino: term,
            lineas: lineas.length,
            unidades: Math.round(unidades * 1000) / 1000,
            bs: totalLineasBs,
            usd: totalUsdLineasVista,
        };
    }, [articuloFiltro, lineasOrdenadas, totalLineasBs, totalUsdLineasVista]);

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

    const lineasSeleccionablesIds = useMemo(
        () =>
            lineasOrdenadas
                .filter((r) => r.esLinea && r.lineaId)
                .map((r) => r.lineaId as string),
        [lineasOrdenadas],
    );

    const todasLineasSeleccionadas = useMemo(
        () =>
            lineasSeleccionablesIds.length > 0 &&
            lineasSeleccionablesIds.every((id) => selectedLineaIds.has(id)),
        [lineasSeleccionablesIds, selectedLineaIds],
    );

    const algunaLineaSeleccionada = selectedLineaIds.size > 0;
    const lineasSelectIndeterminada =
        algunaLineaSeleccionada && !todasLineasSeleccionadas;

    useEffect(() => {
        setSelectedLineaIds((prev) => {
            const visible = new Set(lineasSeleccionablesIds);
            const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [lineasSeleccionablesIds]);

    const toggleSelectLinea = useCallback((lineaId: string) => {
        setSelectedLineaIds((prev) => {
            const next = new Set(prev);
            if (next.has(lineaId)) next.delete(lineaId);
            else next.add(lineaId);
            return next;
        });
    }, []);

    const toggleSelectAllLineas = useCallback(() => {
        setSelectedLineaIds((prev) => {
            if (
                lineasSeleccionablesIds.length > 0 &&
                lineasSeleccionablesIds.every((id) => prev.has(id))
            ) {
                return new Set();
            }
            return new Set(lineasSeleccionablesIds);
        });
    }, [lineasSeleccionablesIds]);

    const compraPorId = useMemo(() => new Map(compras.map((c) => [c.id, c])), [compras]);

    const handleDeleteLinea = async (compraId: string, lineaId: string) => {
        const c = compraPorId.get(compraId);
        if (!c) return;
        if (compraId.startsWith('canal-')) {
            setError('Esta factura aún no está en contabilidad. Elimínela desde el listado de pendientes.');
            return;
        }

        const ok = window.confirm(
            `¿Eliminar esta línea de la compra?\n\n${c.supplier_name} · Factura #${c.invoice_number}\n\nSe ajustará el total de la factura y el inventario si aplica.`,
        );
        if (!ok) return;

        setDeletingLineaId(lineaId);
        setError(null);
        try {
            const res = await fetch(
                `/api/contabilidad/compras/${encodeURIComponent(compraId)}/lineas/${encodeURIComponent(lineaId)}`,
                { method: 'DELETE' },
            );
            const data = (await res.json()) as {
                compraEliminada?: boolean;
                materialPermaneceEnStock?: boolean;
                error?: string;
            };
            if (!res.ok) throw new Error(data.error || 'No se pudo eliminar la línea');

            if (data.compraEliminada) {
                setCompras((prev) => prev.filter((row) => row.id !== compraId));
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(compraId);
                    return next;
                });
            }

            setSelectedLineaIds((prev) => {
                const next = new Set(prev);
                next.delete(lineaId);
                return next;
            });

            if (data.materialPermaneceEnStock) {
                setError(
                    'Línea eliminada. El material permanece en inventario porque ya estaba aprobado en recepción.',
                );
            }

            void load();
        } catch (e) {
            setError(formatDeleteCompraError(e));
            void load();
        } finally {
            setDeletingLineaId(null);
        }
    };

    const accionesCompra = useCallback(
        (compraId: string) => {
            const c = compraPorId.get(compraId);
            if (!c) return null;
            const canalId = idCanalTelegram(c);
            const esApp =
                c.fuente_lista === 'app' ||
                (!compraId.startsWith('canal-') && c.origen !== 'TELEGRAM');
            return {
                puedeModificar: Boolean(canalId),
                puedeModificarLinea: esApp && !compraId.startsWith('canal-'),
                etiquetaEliminar: 'Borrar',
                puedeEliminarLinea: esApp && !compraId.startsWith('canal-'),
            };
        },
        [compraPorId],
    );

    const onModificarLinea = useCallback(
        (row: FilaFacturaCanal) => {
            if (!row.lineaId) return;
            const c = compraPorId.get(row.pendienteId);
            setEditandoLinea({
                compraId: row.pendienteId,
                lineaId: row.lineaId,
                descripcion: row.articulo,
                item_code: row.codigo || null,
                cantidad: Number(row.cantidad) || 0,
                precio_unitario: Number(row.precioUnitario) || 0,
                moneda: c ? monedaOriginalCompra(c) : row.monedaOriginal,
            });
        },
        [compraPorId],
    );

    const guardarLineaCompra = async (
        payload: Omit<LineaCompraEditable, 'compraId' | 'lineaId' | 'moneda'>,
    ) => {
        if (!editandoLinea) return;
        const res = await fetch(
            `/api/contabilidad/compras/${encodeURIComponent(editandoLinea.compraId)}/lineas/${encodeURIComponent(editandoLinea.lineaId)}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            },
        );
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'No se pudo modificar la línea');
        setEditandoLinea(null);
        await load();
    };

    const handleBulkDeleteLineas = async () => {
        if (selectedLineaIds.size === 0) return;
        const n = selectedLineaIds.size;
        if (
            !window.confirm(
                `¿Eliminar ${n} línea(s) seleccionada(s)?\n\nSe ajustarán los totales de cada factura.`,
            )
        ) {
            return;
        }
        setDeletingLineasBulk(true);
        setError(null);
        const ids = Array.from(selectedLineaIds);
        let ok = 0;
        let fail = 0;
        for (const lineaId of ids) {
            const row = lineasOrdenadas.find((r) => r.lineaId === lineaId);
            if (!row?.lineaId) continue;
            try {
                const res = await fetch(
                    `/api/contabilidad/compras/${encodeURIComponent(row.pendienteId)}/lineas/${encodeURIComponent(lineaId)}`,
                    { method: 'DELETE' },
                );
                const data = (await res.json()) as { error?: string; compraEliminada?: boolean };
                if (!res.ok) throw new Error(data.error || 'Error');
                if (data.compraEliminada) {
                    setCompras((prev) => prev.filter((r) => r.id !== row.pendienteId));
                }
                ok += 1;
            } catch {
                fail += 1;
            }
        }
        setSelectedLineaIds(new Set());
        await load();
        setDeletingLineasBulk(false);
        if (fail > 0) {
            setError(`${fail} línea(s) no se pudieron eliminar. ${ok} eliminada(s).`);
        }
    };

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

    const scrollToCompra = useCallback((compraId: string) => {
        setVistaListado('facturas');
        setImagenFacturaAbierta(compraId);
        requestAnimationFrame(() => {
            document.getElementById(`compra-row-${compraId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        });
    }, []);

    useEffect(() => {
        if (!compraDeepLinkId || loading || compraDeepLinkHandled.current) return;
        if (!compras.some((c) => c.id === compraDeepLinkId)) return;
        compraDeepLinkHandled.current = true;
        scrollToCompra(compraDeepLinkId);
    }, [compraDeepLinkId, loading, compras, scrollToCompra]);

    const abrirVerificarFechaCompra = useCallback((c: CompraRow) => {
        const meta = metaAlertaFechaCompra({
            fecha: String(c.fecha ?? '').slice(0, 10),
            alertaAlmacenada: c.alerta_fecha,
            fechaConfirmadaManual: c.fecha_confirmada_manual,
            umbrales: umbralesFecha,
        });
        if (!meta.requiereVerificacion) return;

        const esCanalSolo = c.id.startsWith('canal-');
        const pendienteCanalId =
            c.pendiente_canal_id?.trim() ||
            (esCanalSolo ? c.id.slice('canal-'.length) : null);
        const compraContabilidadId = esCanalSolo ? '' : c.id;

        if (!compraContabilidadId && !pendienteCanalId) return;

        setVerificandoFecha({
            compraId: compraContabilidadId || pendienteCanalId!,
            pendienteCanalId,
            esCanalSolo: esCanalSolo || !compraContabilidadId,
            fechaFactura: String(c.fecha ?? '').slice(0, 10),
            fechaRegistro: c.created_at ? String(c.created_at).slice(0, 10) : null,
            tasaBcv: esCanalSolo ? null : tasaParaCompra(c),
            proveedor: c.supplier_name?.trim() || undefined,
            factura: c.invoice_number ?? undefined,
            nivelAlerta: meta.nivel === 'advertencia' ? 'advertencia' : 'critico',
            mensajeAuditoria: meta.mensaje,
        });
    }, [tasaParaCompra, umbralesFecha]);

    const onVerificarFechaFila = useCallback(
        (row: FilaFacturaCanal) => {
            const c =
                compraPorId.get(row.pendienteId) ??
                compras.find((x) => x.id === row.pendienteId);
            if (c) abrirVerificarFechaCompra(c);
        },
        [compraPorId, compras, abrirVerificarFechaCompra],
    );

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
            const shareUrl =
                typeof window !== 'undefined'
                    ? buildComprasCuadroShareUrl(window.location.origin, estadoCompartir)
                    : '';
            abrirComprasCuadroVentana({
                subtitulo: subtituloCuadro,
                filas: lineasOrdenadas,
                totalUsd: totalUsdLineasVista,
                totalBs: totalLineasBs,
                sortColumn,
                sortDir,
                share: shareUrl
                    ? {
                          titulo: 'Cuadro de compras — Casa Inteligente',
                          resumen: `${etiquetaScopeExport('filtrado')} · USD ${formatearUsd(totalUsdLineasVista)} · Bs ${formatearBs(totalLineasBs)}`,
                          url: shareUrl,
                      }
                    : null,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo abrir la vista PDF');
        }
    };

    const construirLineasExport = useCallback(
        (scope: ComprasExportScope) => {
            const base = scope === 'filtrado' ? lineasFiltradas : lineasCuadroCompleto;
            return ordenarLineasCompras(base, sortColumn, sortDir);
        },
        [lineasFiltradas, lineasCuadroCompleto, sortColumn, sortDir],
    );

    const etiquetaScopeExport = useCallback(
        (scope: ComprasExportScope) =>
            scope === 'filtrado'
                ? `Vista filtrada (${lineasOrdenadas.length} línea(s) · ${compras.length} factura(s))`
                : `Cuadro completo (${lineasCuadroCompleto.length} línea(s) · ${comprasCuadroBase.length} factura(s))`,
        [lineasOrdenadas.length, compras.length, lineasCuadroCompleto.length, comprasCuadroBase.length],
    );

    const exportarCuadroExcel = useCallback(
        (scope: ComprasExportScope) => {
            const filas = construirLineasExport(scope);
            if (!exportarComprasCuadroExcel(filas, scope)) {
                setError('No hay líneas para exportar.');
            }
        },
        [construirLineasExport],
    );

    const construirComprasReporteCliente = useCallback(
        (scope: ComprasExportScope) => (scope === 'filtrado' ? compras : comprasCuadroBase),
        [compras, comprasCuadroBase],
    );

    const filasReporteCliente = useMemo(
        () =>
            buildReporteClienteDesdeCompras(
                construirComprasReporteCliente(exportScope),
                tasaParaCompra,
            ),
        [construirComprasReporteCliente, exportScope, tasaParaCompra],
    );

    const abrirReporteCliente = useCallback(() => {
        const base = construirComprasReporteCliente(exportScope);
        if (!base.length) {
            setError('No hay facturas para generar el reporte cliente.');
            return;
        }
        setReporteClienteAbierto(true);
    }, [construirComprasReporteCliente, exportScope]);

    const compartirCuadro = async (scope: ComprasExportScope = 'filtrado') => {
        if (typeof window === 'undefined') return;
        const filas = construirLineasExport(scope);
        if (filas.length === 0 && compras.length === 0 && comprasCuadroBase.length === 0) return;
        const url = buildComprasCuadroShareUrl(window.location.origin, estadoCompartir);
        const resumen = `${etiquetaScopeExport(scope)} · USD ${formatearUsd(totalFiltrado.totalUsd)} · Bs ${formatearBs(totalFiltrado.totalBs)}`;
        const titulo = 'Cuadro de compras — Casa Inteligente';
        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: titulo, text: resumen, url });
                return;
            } catch (e) {
                if (e instanceof Error && e.name === 'AbortError') return;
            }
        }
        const tsv = filas.length > 0 ? `\n\n${lineasComprasATsv(filas)}` : '';
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
        <div
            className="compras-page"
            style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}
        >
            <div
                className="compras-no-imprimir compras-page-header"
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                    type="button"
                    onClick={() => setCargarFacturaOpen(true)}
                    title="Importar CSV o tabla histórica a Contabilidad de la obra (sin stock)"
                    style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#fff',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(52,199,89,0.45)',
                        background: 'rgba(52,199,89,0.22)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                    }}
                >
                    <FileUp size={13} />
                    Importar CSV
                </button>
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
            </div>

            <div className="compras-page-body">
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
                    <div className="compras-cuadro-header-row">
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700, margin: 0 }}>
                            TOTAL FILTRADO ({compras.length} compra{compras.length === 1 ? '' : 's'})
                        </p>
                        {compras.length > 0 || comprasCuadroBase.length > 0 ? (
                            <div className="compras-no-imprimir compras-cuadro-toolbar">
                                <select
                                    value={exportScope}
                                    onChange={(e) =>
                                        setExportScope(e.target.value as ComprasExportScope)
                                    }
                                    style={{
                                        padding: '8px 10px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        background: 'rgba(0,0,0,0.45)',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 800,
                                    }}
                                    aria-label="Alcance de exportación"
                                >
                                    <option value="filtrado">
                                        Filtrado ({lineasOrdenadas.length} líneas)
                                    </option>
                                    <option value="completo">
                                        Completo ({lineasCuadroCompleto.length} líneas)
                                    </option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() => exportarCuadroExcel(exportScope)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(52,199,89,0.55)',
                                        background: 'rgba(52,199,89,0.22)',
                                        color: '#bbf7d0',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Download size={14} />
                                    Excel
                                </button>
                                <button
                                    type="button"
                                    onClick={abrirReporteCliente}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(251,191,36,0.45)',
                                        background: 'rgba(251,191,36,0.15)',
                                        color: '#fde68a',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <FileSpreadsheet size={14} />
                                    Reporte Cliente
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void compartirCuadro(exportScope)}
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
                                    {compartidoOk ? 'Copiado' : 'Compartir'}
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
                    {resumenArticuloFiltrado ? (
                        <div
                            className="compras-no-imprimir"
                            style={{
                                marginBottom: '14px',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: '1px solid rgba(88,86,214,0.45)',
                                background: 'rgba(88,86,214,0.15)',
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '10px 16px',
                            }}
                            role="status"
                            aria-label={`Resumen del artículo ${resumenArticuloFiltrado.termino}`}
                        >
                            <span
                                style={{
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    letterSpacing: '0.06em',
                                    color: '#c7d2fe',
                                    textTransform: 'uppercase',
                                }}
                            >
                                Artículo «{resumenArticuloFiltrado.termino}»
                            </span>
                            <span
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    color: '#fff',
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {resumenArticuloFiltrado.unidades.toLocaleString('es-VE')} und
                            </span>
                            <span
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    color: '#FFD60A',
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {formatearBs(resumenArticuloFiltrado.bs)}
                            </span>
                            <span
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    color: '#FF3B30',
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {formatearUsd(resumenArticuloFiltrado.usd)}
                            </span>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
                                {resumenArticuloFiltrado.lineas} línea(s) · solo este artículo
                            </span>
                        </div>
                    ) : null}
                    <div className="compras-cuadro-totales">
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
                            <p className="compras-cuadro-total-monto" style={{ color: '#FF3B30', margin: 0 }}>
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
                            <p className="compras-cuadro-total-monto" style={{ color: '#FFD60A', margin: 0 }}>
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
                    <div className="compras-no-imprimir compras-vista-toggle" style={{ marginBottom: '16px' }}>
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

                {showList && vistaListado === 'facturas' ? (
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

                {!loading && vistaListado === 'lineas' && showLineas ? (
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
                            border: algunaLineaSeleccionada
                                ? '1px solid rgba(88,86,214,0.45)'
                                : '1px solid rgba(255,255,255,0.08)',
                            background: algunaLineaSeleccionada
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
                                type="checkbox"
                                checked={todasLineasSeleccionadas}
                                ref={(el) => {
                                    if (el) el.indeterminate = lineasSelectIndeterminada;
                                }}
                                onChange={toggleSelectAllLineas}
                                disabled={lineasSeleccionablesIds.length === 0}
                                style={{ width: 16, height: 16, accentColor: '#5856D6' }}
                            />
                            {todasLineasSeleccionadas
                                ? 'Quitar selección de líneas'
                                : `Seleccionar todas las líneas (${lineasSeleccionablesIds.length})`}
                        </label>
                        {algunaLineaSeleccionada ? (
                            <>
                                <span style={{ color: '#a5a3ff', fontSize: '12px', fontWeight: 800 }}>
                                    {selectedLineaIds.size} línea(s) seleccionada(s)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void handleBulkDeleteLineas()}
                                    disabled={
                                        deletingLineasBulk ||
                                        deletingId !== null ||
                                        deletingLineaId !== null
                                    }
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
                                        cursor: deletingLineasBulk ? 'not-allowed' : 'pointer',
                                        opacity: deletingLineasBulk ? 0.6 : 1,
                                    }}
                                >
                                    {deletingLineasBulk ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={14} />
                                    )}
                                    Borrar líneas seleccionadas
                                </button>
                            </>
                        ) : (
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                                Marque líneas para borrar en lote, o use Modificar / Borrar línea en cada fila.
                            </span>
                        )}
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
                            umbralesFecha={umbralesFecha}
                            onScrollToCompra={scrollToCompra}
                            accionesPorCompra={accionesCompra}
                            onModificar={onModificarCompra}
                            onVerificarFecha={onVerificarFechaFila}
                            onModificarLinea={onModificarLinea}
                            onEliminarLinea={handleDeleteLinea}
                            deletingLineaId={deletingLineaId}
                            deletingId={deletingId}
                            sortColumn={sortColumn}
                            sortDir={sortDir}
                            onSort={onSortColumna}
                            ordenPlano={ordenPlanoTabla}
                            modoSeleccionLinea
                            selectedLineaIds={selectedLineaIds}
                            onToggleLinea={toggleSelectLinea}
                            onToggleSelectAllLineas={toggleSelectAllLineas}
                            todasLineasSeleccionadas={todasLineasSeleccionadas}
                            lineasSelectIndeterminate={lineasSelectIndeterminada}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', marginTop: '24px', color: 'rgba(255,255,255,0.35)' }}>
                            <p style={{ fontSize: '15px', fontWeight: 700 }}>Sin líneas con estos filtros</p>
                        </div>
                    )
                ) : null}

                {showList && vistaListado === 'facturas' ? (
                    <ComprasFacturasTable
                        compras={compras}
                        umbralesFecha={umbralesFecha}
                        selectedIds={selectedIds}
                        onToggleCompra={toggleSelectCompra}
                        imagenFacturaAbierta={imagenFacturaAbierta}
                        onToggleImagen={toggleImagenFactura}
                        deletingId={deletingId}
                        deletingBulk={deletingBulk}
                        ingresandoAlmacenId={ingresandoAlmacenId}
                        cambiandoMonedaId={cambiandoMonedaId}
                        tasaDisplayCompra={tasaDisplayCompra}
                        onReubicar={setReubicarCompra}
                        onIngresoAlmacen={(c) => void handleIngresoAlmacen(c)}
                        onVerificarFecha={abrirVerificarFechaCompra}
                        onModificar={(c) => void abrirEditarTelegram(c)}
                        onEliminar={(c) => void handleDelete(c)}
                        onCambiarMoneda={(c, moneda) => void cambiarMonedaCompra(c, moneda)}
                        onReload={() => void load()}
                    />
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
                        <ComprasLineasTable filas={lineasOrdenadas} umbralesFecha={umbralesFecha} />
                    </div>
                ) : null}
                </div>
            </div>

            <ReporteClienteComprasModal
                open={reporteClienteAbierto}
                filas={filasReporteCliente}
                scope={exportScope}
                subtitulo={subtituloCuadro}
                shareUrl={
                    typeof window !== 'undefined'
                        ? buildComprasCuadroShareUrl(window.location.origin, estadoCompartir)
                        : undefined
                }
                onClose={() => setReporteClienteAbierto(false)}
            />

            <VerificarFechaCompraModal
                open={verificandoFecha != null}
                compraId={verificandoFecha?.compraId ?? ''}
                pendienteCanalId={verificandoFecha?.pendienteCanalId}
                esCanalSolo={verificandoFecha?.esCanalSolo}
                fechaFactura={verificandoFecha?.fechaFactura ?? ''}
                fechaRegistro={verificandoFecha?.fechaRegistro}
                tasaBcv={verificandoFecha?.tasaBcv}
                proveedor={verificandoFecha?.proveedor}
                factura={verificandoFecha?.factura}
                nivelAlerta={verificandoFecha?.nivelAlerta}
                mensajeAuditoria={verificandoFecha?.mensajeAuditoria ?? ''}
                onClose={() => setVerificandoFecha(null)}
                onConfirmado={() => void load()}
            />

            <EditarFacturaCanalModal
                open={editandoCanal != null}
                extracted={editandoCanal?.extracted ?? null}
                destino={editandoCanal?.destino ?? null}
                versionPendiente={editandoCanal?.versionPendiente ?? null}
                pendienteId={editandoCanal?.pendienteId}
                onClose={() => setEditandoCanal(null)}
                onGuardar={guardarEdicionTelegram}
            />

            <EditarLineaCompraModal
                open={editandoLinea != null}
                linea={editandoLinea}
                onClose={() => setEditandoLinea(null)}
                onGuardar={guardarLineaCompra}
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

            <CargarFacturaCuadroModal
                open={cargarFacturaOpen}
                onClose={() => setCargarFacturaOpen(false)}
                proyectos={proyectos}
                proyectoIdInicial={
                    proyectoFiltro && proyectoFiltro !== 'sin_proyecto' ? proyectoFiltro : null
                }
                onGuardado={(proyectoIdGuardado) => {
                    setCargarFacturaOpen(false);
                    setPeriodo('todas');
                    setFuenteFiltro('todos');
                    setEstadoLogisticaFiltro('');
                    if (proyectoIdGuardado) setProyectoFiltro(proyectoIdGuardado);
                    setComprasReloadToken((n) => n + 1);
                }}
            />
        </div>
    );
}
