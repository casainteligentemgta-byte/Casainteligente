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
    dedupeProveedores,
    orFiltroBusquedaCompras,
    parseMontoFiltro,
    type ProveedorOpcion,
} from '@/lib/contabilidad/comprasQueryFiltros';
import {
    esProyectoSmartRrhhPorNombre,
    loadCatalogoProyectosApp,
    mergeProyectosCatalogo,
    type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import { FileText, Filter, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';

type CompraRow = {
    id: string;
    purchase_invoice_id: string | null;
    proyecto_id: string | null;
    invoice_number: string;
    supplier_rif: string;
    supplier_name: string;
    fecha: string;
    total_amount: number;
    origen: string;
    estado: string;
    document_file_name: string | null;
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

function lineaCoincideBusqueda(linea: LineaDetalle, term: string): boolean {
    const t = term.trim().toLowerCase();
    if (!t) return true;
    const desc = (linea.descripcion || '').toLowerCase();
    const code = (linea.item_code || '').toLowerCase();
    return desc.includes(t) || code.includes(t);
}

function lineasParaMostrar(row: CompraRow, busqueda: string): LineaDetalle[] {
    const det = lineasDetalle(row);
    if (!det.length) return [];
    const t = busqueda.trim();
    if (!t) return [];
    const filtradas = det.filter((l) => lineaCoincideBusqueda(l, t));
    return (filtradas.length ? filtradas : det).slice(0, 6);
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

    const [periodo, setPeriodo] = useState<PeriodoCompras>('todas');
    const [fechaRef, setFechaRef] = useState(todayIso);
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [proyectoFiltro, setProyectoFiltro] = useState<string>('');
    const [proveedorFiltro, setProveedorFiltro] = useState<string>('');
    const [montoMin, setMontoMin] = useState('');
    const [montoMax, setMontoMax] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');

    const rangoActivo = useMemo(
        () => rangoFechasPeriodo(periodo, fechaRef, { desde: fechaDesde, hasta: fechaHasta }),
        [periodo, fechaRef, fechaDesde, fechaHasta]
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

            const idsArticulo = busquedaAplicada
                ? await compraIdsPorArticulo(supabase, busquedaAplicada)
                : [];
            const orBusqueda = busquedaAplicada
                ? orFiltroBusquedaCompras(busquedaAplicada, idsArticulo)
                : null;

            const lineasSelect = busquedaAplicada
                ? 'contabilidad_compra_lineas(descripcion,item_code,subtotal,cantidad)'
                : 'contabilidad_compra_lineas(count)';

            const buildComprasQuery = () => {
                let q = supabase
                    .from('contabilidad_compras')
                    .select(
                        `id,purchase_invoice_id,proyecto_id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,origen,estado,document_file_name,created_at,ci_proyectos(nombre),${lineasSelect}`
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
                let min = parseMontoFiltro(montoMin);
                let max = parseMontoFiltro(montoMax);
                if (min !== null && max !== null && min > max) {
                    const swap = min;
                    min = max;
                    max = swap;
                }
                if (min !== null) q = q.gte('total_amount', min);
                if (max !== null) q = q.lte('total_amount', max);
                if (orBusqueda) q = q.or(orBusqueda);
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

            setCompras(filas);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudieron cargar las compras.');
            setCompras([]);
        } finally {
            setLoading(false);
        }
    }, [periodo, rangoActivo, proyectoFiltro, proveedorFiltro, montoMin, montoMax, busquedaAplicada, proyectos]);

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
        const ok = window.confirm(
            `¿Eliminar la compra de ${c.supplier_name} (factura #${c.invoice_number})?\n\nSe quitará de contabilidad, cuarentena y materiales pendientes.`
        );
        if (!ok) return;

        setDeletingId(c.id);
        setError(null);
        try {
            const supabase = createClient();
            await deleteCompraRegistro(supabase, c.id);
            setCompras((prev) => prev.filter((row) => row.id !== c.id));
        } catch (e) {
            setError(formatDeleteCompraError(e));
        } finally {
            setDeletingId(null);
        }
    };

    const totalEgresos = compras.reduce((acc, c) => acc + Number(c.total_amount || 0), 0);
    const showList = !loading && compras.length > 0;
    const periodoLabel = etiquetaPeriodo(periodo, fechaRef, rangoActivo);

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
                                value={fechaRef}
                                onChange={(e) => setFechaRef(e.target.value)}
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

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700 }}>
                            PROVEEDOR
                        </label>
                        <select
                            value={proveedorFiltro}
                            onChange={(e) => setProveedorFiltro(e.target.value)}
                            style={{ ...inputStyle, marginTop: '6px' }}
                        >
                            <option value="">Todos los proveedores</option>
                            {proveedores.map((p) => (
                                <option key={p.nombre} value={p.nombre}>
                                    {p.nombre}
                                    {p.rif ? ` · ${p.rif}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700, marginBottom: '8px' }}>
                        MONTO TOTAL (USD)
                    </p>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                            gap: '10px',
                            marginBottom: '16px',
                            maxWidth: '100%',
                        }}
                    >
                        <div style={{ minWidth: 0 }}>
                            <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: 700 }}>
                                MÍN.
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={montoMin}
                                onChange={(e) => setMontoMin(e.target.value)}
                                style={{ ...inputMontoStyle, marginTop: '6px', width: '100%' }}
                            />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: 700 }}>
                                MÁX.
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="—"
                                value={montoMax}
                                onChange={(e) => setMontoMax(e.target.value)}
                                style={{ ...inputMontoStyle, marginTop: '6px', width: '100%' }}
                            />
                        </div>
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
                            Busca por nombre o RIF del proveedor, monto exacto, número de factura o descripción/código de
                            artículo en las líneas.
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
                    <p style={{ color: '#FF3B30', fontSize: '28px', fontWeight: 800 }}>${totalEgresos.toFixed(2)}</p>
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
                            Ajuste período, proveedor, montos o la búsqueda.
                        </p>
                    </div>
                ) : null}

                {showList ? (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {compras.map((c) => (
                            <div key={c.id} style={{ ...glass, padding: '18px' }}>
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
                                            {c.fecha} · {lineCount(c)} línea(s)
                                        </p>
                                        {lineasParaMostrar(c, busquedaAplicada).length > 0 ? (
                                            <div
                                                style={{
                                                    marginTop: '10px',
                                                    padding: '10px 12px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(255,255,255,0.04)',
                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                }}
                                            >
                                                {lineasParaMostrar(c, busquedaAplicada).map((l, i) => (
                                                    <p
                                                        key={`${l.descripcion}-${i}`}
                                                        style={{
                                                            color: 'rgba(255,255,255,0.55)',
                                                            fontSize: '11px',
                                                            marginTop: i > 0 ? '6px' : 0,
                                                            lineHeight: 1.35,
                                                        }}
                                                    >
                                                        {l.descripcion}
                                                        {l.item_code ? ` · ${l.item_code}` : ''} — $
                                                        {Number(l.subtotal).toFixed(2)}
                                                    </p>
                                                ))}
                                            </div>
                                        ) : null}
                                        {c.document_file_name ? (
                                            <p
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    color: '#a5a3ff',
                                                    fontSize: '11px',
                                                    marginTop: '8px',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                <FileText size={14} /> {c.document_file_name}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ color: '#FF3B30', fontSize: '20px', fontWeight: 800 }}>
                                            ${Number(c.total_amount).toFixed(2)}
                                        </p>
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
