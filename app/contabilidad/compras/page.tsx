'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
    deleteCompraRegistro,
    formatDeleteCompraError,
} from '@/lib/contabilidad/deleteCompraRegistro';
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
    compraCumpleFiltrosLineas,
    compraCumpleFiltrosMontos,
    filtrarLineasComprasConfirmadas,
} from '@/lib/contabilidad/filtrosFacturaCanal';
import ComprasLineasTable from '@/components/contabilidad/ComprasLineasTable';
import {
    esProyectoSmartRrhhPorNombre,
    loadCatalogoProyectosApp,
    mergeProyectosCatalogo,
    type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import { Filter, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
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

type CompraRow = {
    id: string;
    purchase_invoice_id: string | null;
    proyecto_id: string | null;
    invoice_number: string;
    supplier_rif: string;
    supplier_name: string;
    fecha: string;
    total_amount: number;
    total_amount_usd?: number | null;
    tasa_bcv_ves_por_usd?: number | null;
    origen: string;
    estado: string;
    document_file_name: string | null;
    document_storage_path?: string | null;
    created_at: string;
    ci_proyectos?: { nombre: string | null } | { nombre: string | null }[] | null;
    contabilidad_compra_lineas?:
        | { count: number }[]
        | { descripcion: string; item_code: string | null; subtotal: number; cantidad: number }[];
};

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

function nombreDesdeJoin(row: CompraRow): string | null {
    const p = row.ci_proyectos;
    if (Array.isArray(p) && p[0]?.nombre) return String(p[0].nombre).trim();
    if (p && typeof p === 'object' && 'nombre' in p && p.nombre) {
        return String(p.nombre).trim();
    }
    return null;
}

function proyectoNombre(row: CompraRow, nombresPorId: Map<string, string>): string {
    const desdeJoin = nombreDesdeJoin(row);
    if (desdeJoin) return desdeJoin;
    if (row.proyecto_id) {
        return nombresPorId.get(row.proyecto_id) ?? 'Proyecto sin nombre';
    }
    return 'Sin proyecto';
}

export default function ComprasPage() {
    const [compras, setCompras] = useState<CompraRow[]>([]);
    const [proyectos, setProyectos] = useState<ProyectoOpcion[]>([]);
    const [proveedores, setProveedores] = useState<ProveedorOpcion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [hydrated, setHydrated] = useState(false);
    const [periodo, setPeriodo] = useState<PeriodoCompras>('todas');
    const [fechaRef, setFechaRef] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [proyectoFiltro, setProyectoFiltro] = useState<string>('');
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
    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');

    const fechaRefActiva = fechaRef || (hydrated ? todayIso() : '');
    const { tasa: tasaBcvHoy, fuente: tasaBcvFuente, loading: cargandoTasaHoy } = useTasaBcvHoy(
        fechaRefActiva || undefined,
    );

    const rangoActivo = useMemo(
        () =>
            fechaRefActiva
                ? rangoFechasPeriodo(periodo, fechaRefActiva, { desde: fechaDesde, hasta: fechaHasta })
                : null,
        [periodo, fechaRefActiva, fechaDesde, fechaHasta],
    );

    useEffect(() => {
        setHydrated(true);
        setFechaRef(todayIso());
    }, []);

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
        void loadProveedores();
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
        return m;
    }, [proyectos]);

    const proyectoFiltroEtiqueta = useMemo(() => {
        if (!proyectoFiltro) return 'Todos los proyectos';
        if (proyectoFiltro === 'sin_proyecto') return 'Sin proyecto asignado';
        return proyectosMap.get(proyectoFiltro) ?? 'Proyecto';
    }, [proyectoFiltro, proyectosMap]);

    const proyectosPrincipales = useMemo(
        () => proyectos.filter((p) => esProyectoSmartRrhhPorNombre(p.nombre)),
        [proyectos]
    );
    const proyectosResto = useMemo(
        () => proyectos.filter((p) => !esProyectoSmartRrhhPorNombre(p.nombre)),
        [proyectos]
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();

            const idsArticuloBusqueda = busquedaAplicada
                ? await compraIdsPorArticulo(supabase, busquedaAplicada)
                : [];
            const orBusqueda = busquedaAplicada
                ? orFiltroBusquedaCompras(busquedaAplicada, idsArticuloBusqueda)
                : null;

            const artTerm = articuloFiltro.trim();
            let minCant = parseMontoFiltro(cantidadMin);
            let maxCant = parseMontoFiltro(cantidadMax);
            if (minCant !== null && maxCant !== null && minCant > maxCant) {
                [minCant, maxCant] = [maxCant, minCant];
            }

            let idsPorLinea: string[] | null = null;
            if (artTerm) {
                idsPorLinea = await compraIdsPorArticulo(supabase, artTerm);
            }
            if (minCant !== null || maxCant !== null) {
                const idsCant = await compraIdsPorCantidad(supabase, minCant, maxCant);
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

            const buildComprasQuery = () => {
                let q = supabase
                    .from('contabilidad_compras')
                    .select(
                        `id,purchase_invoice_id,proyecto_id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,total_amount_usd,tasa_bcv_ves_por_usd,origen,estado,document_file_name,document_storage_path,created_at,ci_proyectos(nombre),${lineasSelect}`
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

            const pageSize = 500;
            const maxFilas = 5000;
            let filas: CompraRow[] = [];

            if (periodo === 'todas') {
                for (let from = 0; from < maxFilas; from += pageSize) {
                    const { data, error: pageErr } = await buildComprasQuery().range(from, from + pageSize - 1);
                    if (pageErr) {
                        if (
                            pageErr.message.includes('contabilidad_compras') ||
                            pageErr.message.includes('does not exist') ||
                            pageErr.message.includes('proyecto_id')
                        ) {
                            throw new Error(
                                'Tabla de compras incompleta. Ejecute la migración 138_compras_proyecto_y_borrado.sql en Supabase.'
                            );
                        }
                        throw pageErr;
                    }
                    const chunk = (data ?? []) as CompraRow[];
                    if (!chunk.length) break;
                    filas = filas.concat(chunk);
                    if (chunk.length < pageSize) break;
                }
            } else {
                const { data, error: qErr } = await buildComprasQuery().limit(pageSize);
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
                filas = (data ?? []) as CompraRow[];
            }

            const idsConocidos = new Set(proyectos.map((p) => p.id));
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

            filas = filas.filter((c) => {
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
        proyectos,
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

    const handleDelete = async (c: CompraRow) => {
        const duplicadasMismaFactura = compras.filter(
            (row) =>
                row.id !== c.id &&
                String(row.invoice_number ?? '').trim().replace(/^#+/, '') ===
                    String(c.invoice_number ?? '').trim().replace(/^#+/, '') &&
                (!c.supplier_rif ||
                    String(row.supplier_rif ?? '').trim().toUpperCase() ===
                        String(c.supplier_rif ?? '').trim().toUpperCase()),
        );
        const avisoDuplicado =
            duplicadasMismaFactura.length > 0
                ? `\n\nHay ${duplicadasMismaFactura.length + 1} registro(s) con factura #${c.invoice_number}. Se eliminarán todos.`
                : '';

        const ok = window.confirm(
            `¿Eliminar la compra de ${c.supplier_name} (factura #${c.invoice_number})?${avisoDuplicado}\n\nSe quitará de contabilidad, cuarentena y materiales pendientes.`
        );
        if (!ok) return;

        setDeletingId(c.id);
        setError(null);
        try {
            const supabase = createClient();
            const result = await deleteCompraRegistro(supabase, c.id);
            const removed = new Set(result.deletedIds);
            setCompras((prev) => prev.filter((row) => !removed.has(row.id)));
            if (result.duplicateCount > 1) {
                void load();
            }
        } catch (e) {
            setError(formatDeleteCompraError(e));
            void load();
        } finally {
            setDeletingId(null);
        }
    };

    const totalFiltrado = useMemo(() => {
        let totalUsd = 0;
        let totalBs = 0;
        const tasas = new Set<number>();
        const fechas = new Set<string>();
        let comprasSinTasaEnFactura = 0;

        for (const c of compras) {
            const bs = montoVesCompra(c);
            totalBs += bs;
            const tasaFactura = tasaBcvCompra(c);
            if (tasaFactura) {
                tasas.add(tasaFactura);
            } else {
                comprasSinTasaEnFactura += 1;
            }
            const usd =
                vesAUsdConTasa(bs, tasaFactura ?? tasaBcvHoy) ?? montoUsdCompra(c);
            totalUsd += usd;

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
    }, [compras, tasaBcvHoy]);

    const filtrosLineas = useMemo(
        () => ({
            fechaDesde: rangoActivo?.desde ?? '',
            fechaHasta: rangoActivo?.hasta ?? '',
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
            tasa_bcv_ves_por_usd: c.tasa_bcv_ves_por_usd ?? tasaBcvHoy,
            origen: c.origen,
            estado: c.estado,
            proyectoNombre: proyectoNombre(c, proyectosMap),
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
    }, [compras, filtrosLineas, proyectosMap, tasaBcvHoy]);

    const totalLineasBs = useMemo(
        () =>
            lineasFiltradas.reduce((acc, row) => {
                const bs = row.esLinea ? row.cantidad * row.precioUnitario : row.montoBs;
                return acc + bs;
            }, 0),
        [lineasFiltradas],
    );

    const totalUsdLineasVista = useMemo(
        () =>
            Math.round(
                lineasFiltradas.reduce((acc, row) => {
                    const bs = row.esLinea ? row.cantidad * row.precioUnitario : row.montoBs;
                    const usd = vesAUsdConTasa(bs, row.tasaBcv);
                    if (usd != null) return acc + usd;
                    if (row.montoUsd != null && row.montoBs > 0) {
                        return acc + (bs / row.montoBs) * row.montoUsd;
                    }
                    return acc;
                }, 0) * 100,
            ) / 100,
        [lineasFiltradas],
    );

    const showList = !loading && compras.length > 0;
    const showLineas = !loading && lineasFiltradas.length > 0;
    const periodoLabel = fechaRefActiva ? etiquetaPeriodo(periodo, fechaRefActiva, rangoActivo) : '';

    function tasaDisplayCompra(c: CompraRow): number | null {
        return tasaBcvCompra(c) ?? tasaBcvHoy;
    }

    const scrollToCompra = (compraId: string) => {
        setVistaListado('facturas');
        requestAnimationFrame(() => {
            document.getElementById(`compra-card-${compraId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        });
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
            <div
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
                <Link
                    href="/contabilidad/compras/canal"
                    style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#7dd3fc',
                        textDecoration: 'none',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(56,189,248,0.35)',
                        background: 'rgba(14,116,144,0.2)',
                    }}
                >
                    Telegram
                </Link>
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
                        Totales y botones en <strong style={{ color: '#FF3B30' }}>USD</strong> (tasa de la factura o del día).
                        Precio unitario de cada artículo en <strong style={{ color: '#FFD60A' }}>bolívares</strong>.
                    </p>
                </div>

                <div style={{ ...glass, padding: '20px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Filter size={16} style={{ color: '#5856D6' }} />
                        <p style={{ color: 'white', fontSize: '13px', fontWeight: 800 }}>FILTROS</p>
                    </div>

                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700, marginBottom: '8px' }}>
                        PERÍODO
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                        {(
                            [
                                ['todas', 'Todas'],
                                ['dia', 'Día'],
                                ['semana', 'Semana'],
                                ['mes', 'Mes'],
                                ['rango', 'Rango'],
                            ] as const
                        ).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                style={periodBtn(periodo === key)}
                                onClick={() => {
                                    setPeriodo(key);
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {periodo === 'dia' || periodo === 'semana' || periodo === 'mes' ? (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700 }}>
                                {periodo === 'dia' ? 'FECHA' : periodo === 'semana' ? 'SEMANA DEL' : 'MES DE'}
                            </label>
                            <input
                                type="date"
                                value={fechaRefActiva}
                                onChange={(e) => setFechaRef(e.target.value)}
                                suppressHydrationWarning
                                style={{ ...inputStyle, marginTop: '6px' }}
                            />
                        </div>
                    ) : null}

                    {periodo === 'rango' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700 }}>
                                    DESDE
                                </label>
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={(e) => setFechaDesde(e.target.value)}
                                    style={{ ...inputStyle, marginTop: '6px' }}
                                />
                            </div>
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700 }}>
                                    HASTA
                                </label>
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={(e) => setFechaHasta(e.target.value)}
                                    style={{ ...inputStyle, marginTop: '6px' }}
                                />
                            </div>
                        </div>
                    ) : null}

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '12px',
                            marginBottom: '16px',
                        }}
                    >
                        <div>
                            <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700 }}>
                                PROVEEDOR
                            </label>
                            <select
                                value={proveedorFiltro}
                                onChange={(e) => setProveedorFiltro(e.target.value)}
                                style={{ ...inputStyle, marginTop: '6px' }}
                            >
                                <option value="">Todos</option>
                                {proveedores.map((p) => (
                                    <option key={p.nombre} value={p.nombre}>
                                        {p.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700 }}>
                                RIF
                            </label>
                            <input
                                type="search"
                                value={rifFiltro}
                                onChange={(e) => setRifFiltro(e.target.value)}
                                placeholder="J-12345678-9"
                                style={{ ...inputStyle, marginTop: '6px' }}
                            />
                        </div>
                    </div>

                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700, marginBottom: '8px' }}>
                        MONTO TOTAL (Bs)
                    </p>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            marginBottom: '12px',
                        }}
                    >
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Mín. Bs"
                            value={montoMinBs}
                            onChange={(e) => setMontoMinBs(e.target.value)}
                            style={inputMontoStyle}
                        />
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Máx. Bs"
                            value={montoMaxBs}
                            onChange={(e) => setMontoMaxBs(e.target.value)}
                            style={inputMontoStyle}
                        />
                    </div>

                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700, marginBottom: '8px' }}>
                        MONTO TOTAL (USD)
                    </p>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            marginBottom: '16px',
                        }}
                    >
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Mín. USD"
                            value={montoMinUsd}
                            onChange={(e) => setMontoMinUsd(e.target.value)}
                            style={inputMontoStyle}
                        />
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Máx. USD"
                            value={montoMaxUsd}
                            onChange={(e) => setMontoMaxUsd(e.target.value)}
                            style={inputMontoStyle}
                        />
                    </div>

                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700, marginBottom: '8px' }}>
                        ARTÍCULO Y CANTIDAD (líneas)
                    </p>
                    <div style={{ marginBottom: '10px' }}>
                        <input
                            type="search"
                            value={articuloFiltro}
                            onChange={(e) => setArticuloFiltro(e.target.value)}
                            placeholder="Descripción o código de artículo"
                            style={inputStyle}
                        />
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            marginBottom: '16px',
                        }}
                    >
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Cant. mín."
                            value={cantidadMin}
                            onChange={(e) => setCantidadMin(e.target.value)}
                            style={inputMontoStyle}
                        />
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Cant. máx."
                            value={cantidadMax}
                            onChange={(e) => setCantidadMax(e.target.value)}
                            style={inputMontoStyle}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700 }}>
                            PROYECTO
                        </label>
                        <p
                            style={{
                                color: '#5856D6',
                                fontSize: '12px',
                                fontWeight: 800,
                                marginTop: '6px',
                                marginBottom: '8px',
                            }}
                        >
                            {proyectoFiltroEtiqueta}
                        </p>
                        <select
                            value={proyectoFiltro}
                            onChange={(e) => setProyectoFiltro(e.target.value)}
                            style={{ ...inputStyle, marginTop: '0' }}
                        >
                            <option value="">Todos los proyectos</option>
                            <option value="sin_proyecto">Sin proyecto</option>
                            {proyectosPrincipales.length > 0 ? (
                                <optgroup label="Obras principales">
                                    {proyectosPrincipales.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.nombre}
                                        </option>
                                    ))}
                                </optgroup>
                            ) : null}
                            {proyectosResto.length > 0 ? (
                                <optgroup label="Otros proyectos">
                                    {proyectosResto.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.nombre}
                                        </option>
                                    ))}
                                </optgroup>
                            ) : null}
                        </select>
                    </div>

                    <div>
                        <label
                            style={{
                                color: 'rgba(255,255,255,0.45)',
                                fontSize: '10px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            <Search size={12} /> BÚSQUEDA
                        </label>
                        <input
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Proveedor, RIF, monto, artículo, factura…"
                            style={{ ...inputStyle, marginTop: '6px' }}
                        />
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', marginTop: '8px', lineHeight: 1.4 }}>
                            Búsqueda rápida adicional (factura, proveedor, RIF, monto o artículo).
                        </p>
                    </div>

                    {periodoLabel ? (
                        <p style={{ color: '#5856D6', fontSize: '11px', fontWeight: 700, marginTop: '14px' }}>
                            Mostrando: {periodoLabel}
                            {busquedaAplicada ? ` · búsqueda: «${busquedaAplicada}»` : ''}
                        </p>
                    ) : busquedaAplicada ? (
                        <p style={{ color: '#5856D6', fontSize: '11px', fontWeight: 700, marginTop: '14px' }}>
                            Búsqueda: «{busquedaAplicada}»
                        </p>
                    ) : null}
                </div>

                <div style={{ ...glass, padding: '20px', marginBottom: '20px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700 }}>
                        TOTAL FILTRADO ({compras.length} compra{compras.length === 1 ? '' : 's'})
                    </p>
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
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', marginTop: '60px', color: 'rgba(255,255,255,0.4)' }}>
                        <Loader2 className="animate-spin mx-auto mb-3" size={32} />
                        <p>Cargando compras…</p>
                    </div>
                ) : null}

                {error ? (
                    <div
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

                {!loading && compras.length === 0 && !error ? (
                    <div style={{ textAlign: 'center', marginTop: '48px', color: 'rgba(255,255,255,0.35)' }}>
                        <p style={{ fontSize: '18px', fontWeight: 700 }}>Sin compras con estos filtros</p>
                        <p style={{ fontSize: '13px', marginTop: '8px' }}>
                            Ajuste fecha, proveedor, RIF, montos Bs/USD, artículo o cantidad.
                        </p>
                    </div>
                ) : null}

                {!loading && compras.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button
                            type="button"
                            onClick={() => setVistaListado('lineas')}
                            style={periodBtn(vistaListado === 'lineas')}
                        >
                            Por línea / artículo
                            {lineasFiltradas.length > 0 ? (
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

                {!loading && vistaListado === 'lineas' && lineasFiltradas.length > 0 ? (
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
                            filas={lineasFiltradas}
                            onScrollToCompra={scrollToCompra}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', marginTop: '24px', color: 'rgba(255,255,255,0.35)' }}>
                            <p style={{ fontSize: '15px', fontWeight: 700 }}>Sin líneas con estos filtros</p>
                        </div>
                    )
                ) : null}

                {showList && vistaListado === 'facturas' ? (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {compras.map((c) => (
                            <div id={`compra-card-${c.id}`} key={c.id} style={{ ...glass, padding: '18px' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: '12px',
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p
                                            style={{
                                                color: 'white',
                                                fontSize: '17px',
                                                fontWeight: 800,
                                                marginBottom: '4px',
                                            }}
                                        >
                                            {c.supplier_name}
                                        </p>
                                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                                            Factura #{c.invoice_number} · {c.supplier_rif}
                                        </p>
                                        <p
                                            style={{
                                                color: '#5856D6',
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                marginTop: '8px',
                                            }}
                                        >
                                            PROYECTO: {proyectoNombre(c, proyectosMap)}
                                        </p>
                                        <p
                                            style={{
                                                color: 'rgba(255,255,255,0.35)',
                                                fontSize: '11px',
                                                marginTop: '6px',
                                            }}
                                        >
                                            {c.fecha} · {lineCount(c)} producto(s)
                                        </p>
                                        <CompraProductosToggle
                                            compraId={c.id}
                                            tasaBcv={tasaDisplayCompra(c)}
                                            tasaEsDelDia={!tasaBcvCompra(c) && !!tasaBcvHoy}
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
                                        {c.document_storage_path ||
                                        c.purchase_invoice_id ||
                                        c.origen === 'RECEPCION_MERCANCIA' ? (
                                            <CompraFacturaImagen
                                                compraId={c.id}
                                                tieneDocumento={
                                                    Boolean(
                                                        c.document_storage_path ||
                                                            c.purchase_invoice_id,
                                                    )
                                                }
                                                esRecepcion={c.origen === 'RECEPCION_MERCANCIA'}
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
                                        <EtiquetaBimonetariaCompra
                                            usd={
                                                vesAUsdConTasa(montoVesCompra(c), tasaDisplayCompra(c)) ??
                                                montoUsdCompra(c)
                                            }
                                            bs={montoVesCompra(c)}
                                            tasa={tasaDisplayCompra(c)}
                                            tasaEsDelDia={!tasaBcvCompra(c) && !!tasaBcvHoy}
                                            layout="stack"
                                            style={{ alignItems: 'flex-end', fontSize: 18 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(c)}
                                            disabled={deletingId !== null}
                                            style={{
                                                marginTop: '10px',
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
                                            BORRAR
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
