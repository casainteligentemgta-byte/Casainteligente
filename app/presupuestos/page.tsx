'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import PresupuestosFiltrosModal from '@/components/presupuestos/PresupuestosFiltrosModal';

interface Budget {
    id: string;
    customer_name: string;
    customer_rif: string;
    subtotal: number;
    status: 'no_enviado' | 'enviado' | 'aprobado' | 'no_aprobado' | 'cobrado' | 'pagado';
    show_zelle?: boolean;
    numero_correlativo?: number | string | null;
    created_at: string;
}

type ClasificacionPresupuesto =
    | 'no_enviado'
    | 'enviado'
    | 'aprobado'
    | 'no_aprobado'
    | 'cobrado'
    | 'pagado';

const CLASIFICACION_COLORS: Record<ClasificacionPresupuesto, { bg: string; text: string; label: string; icon: string }> = {
    no_enviado: { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8', label: 'No enviado', icon: '📭' },
    enviado: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6', label: 'Enviado', icon: '📨' },
    aprobado: { bg: 'rgba(52,199,89,0.15)', text: '#34C759', label: 'Aprobado', icon: '✅' },
    no_aprobado: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', label: 'No aprobado', icon: '⛔' },
    cobrado: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'Cobrado', icon: '💰' },
    pagado: { bg: 'rgba(16,185,129,0.15)', text: '#10B981', label: 'Pagado', icon: '💸' },
};

function clasificarPresupuesto(b: Budget): ClasificacionPresupuesto {
    return b.status;
}

function formatUSD(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPresupuestoNumero(b: Budget, fallback?: number) {
    const raw = b.numero_correlativo;
    const n =
        typeof raw === 'number'
            ? raw
            : typeof raw === 'string'
                ? Number(raw)
                : null;
    if (n != null && !Number.isNaN(n)) return `P-${n}`;
    if (fallback != null && !Number.isNaN(fallback)) return `P-${fallback}`;
    return `P-${b.id.slice(0, 8).toUpperCase()}`;
}

type VistaPresupuestos = 'filas' | 'columnas';
const VISTA_PRESUPUESTOS_KEY = 'ci-presupuestos-vista-v1';

function TarjetaPresupuesto({
    b,
    vista,
    fallbackById,
    glass,
    onEditar,
    onPreview,
    onShare,
    onDelete,
    onUpdateStatus,
}: {
    b: Budget;
    vista: VistaPresupuestos;
    fallbackById: Record<string, number>;
    glass: CSSProperties;
    onEditar: () => void;
    onPreview: () => void;
    onShare: () => void;
    onDelete: () => void;
    onUpdateStatus: (status: ClasificacionPresupuesto) => void;
}) {
    const clasif = clasificarPresupuesto(b);
    const clasifStyle = CLASIFICACION_COLORS[clasif];
    const fecha = new Date(b.created_at).toLocaleDateString('es-VE');
    const numero = getPresupuestoNumero(b, fallbackById[b.id]);
    const esFilas = vista === 'filas';
    const compacto = vista === 'columnas';

    const btnBase: CSSProperties = {
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        flexShrink: 0,
        whiteSpace: 'nowrap',
    };

    const btnAccion: CSSProperties = {
        ...btnBase,
        padding: compacto ? '5px 7px' : '6px 10px',
        fontSize: compacto ? '10px' : '11px',
    };

    const btnEstado: CSSProperties = {
        ...btnBase,
        padding: compacto ? '5px 6px' : '5px 8px',
        fontSize: compacto ? '10px' : '10px',
    };

    return (
        <div
            style={{
                ...glass,
                padding: '12px',
                position: 'relative',
                borderRadius: '14px',
                paddingBottom: esFilas ? '12px' : '36px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '11px',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                }}
            >
                {numero}
            </span>

            <div style={{ paddingRight: '56px', minHeight: esFilas ? undefined : '52px' }}>
                <h3
                    style={{
                        color: 'white',
                        fontSize: esFilas ? '16px' : '14px',
                        fontWeight: 700,
                        margin: 0,
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {b.customer_name}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', margin: '4px 0 0' }}>
                    {fecha}
                </p>
                <p
                    style={{
                        color: 'rgba(255,255,255,0.35)',
                        fontSize: '10px',
                        margin: '2px 0 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {b.customer_rif}
                </p>
                <div
                    style={{
                        marginTop: '6px',
                        ...clasifStyle,
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '3px 7px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        width: 'fit-content',
                    }}
                >
                    <span>{clasifStyle.icon}</span>
                    <span>{clasifStyle.label}</span>
                </div>
            </div>

            {esFilas ? (
                <p
                    style={{
                        color: '#34C759',
                        fontSize: '18px',
                        fontWeight: 800,
                        margin: '10px 0 0',
                        textAlign: 'right',
                        lineHeight: 1,
                    }}
                >
                    ${formatUSD(b.subtotal)}
                </p>
            ) : null}

            <div
                style={{
                    marginTop: '10px',
                    marginBottom: compacto ? '28px' : 0,
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'nowrap',
                    gap: '4px',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    paddingBottom: '2px',
                }}
            >
                <button
                    type="button"
                    onClick={onEditar}
                    style={{ ...btnAccion, background: 'rgba(0,122,255,0.12)', color: '#007AFF' }}
                    title="Editar"
                >
                    ✏️{compacto ? '' : ' Editar'}
                </button>
                <button
                    type="button"
                    onClick={onPreview}
                    style={{ ...btnAccion, background: 'rgba(88,86,214,0.12)', color: '#A78BFA' }}
                    title="Vista previa"
                >
                    📄{compacto ? '' : ' Vista'}
                </button>
                <button
                    type="button"
                    onClick={onShare}
                    style={{ ...btnAccion, background: 'rgba(52,199,89,0.1)', color: '#34C759' }}
                    title="WhatsApp"
                >
                    📲{compacto ? '' : ' WA'}
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    style={{ ...btnAccion, background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                    title="Eliminar"
                >
                    🗑️
                </button>
                {(Object.keys(CLASIFICACION_COLORS) as ClasificacionPresupuesto[]).map((k) => {
                    const active = b.status === k;
                    const c = CLASIFICACION_COLORS[k];
                    return (
                        <button
                            key={k}
                            type="button"
                            onClick={() => onUpdateStatus(k)}
                            style={{
                                ...btnEstado,
                                background: active ? c.bg : 'rgba(255,255,255,0.04)',
                                color: active ? c.text : 'rgba(255,255,255,0.55)',
                                border: active
                                    ? `1px solid ${c.text}55`
                                    : '1px solid rgba(255,255,255,0.06)',
                            }}
                            title={c.label}
                        >
                            <span>{c.icon}</span>
                            {!compacto ? <span>{c.label}</span> : null}
                        </button>
                    );
                })}
            </div>

            {!esFilas ? (
                <p
                    style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        color: '#34C759',
                        fontSize: '15px',
                        fontWeight: 800,
                        margin: 0,
                        lineHeight: 1,
                    }}
                >
                    ${formatUSD(b.subtotal)}
                </p>
            ) : null}
        </div>
    );
}

export default function PresupuestosPage() {
    const router = useRouter();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'todos' | ClasificacionPresupuesto>('todos');
    const [sortBy, setSortBy] = useState<'fecha' | 'nomenclatura'>('fecha');
    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroRif, setFiltroRif] = useState('');
    const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
    const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
    const [stats, setStats] = useState({
        total: 0,
        noEnviado: 0,
        enviado: 0,
        aprobados: 0,
        noAprobados: 0,
        cobrados: 0,
        pagados: 0,
    });
    const [fallbackById, setFallbackById] = useState<Record<string, number>>({});
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
    const [vista, setVista] = useState<VistaPresupuestos>('filas');
    const [pantallaAncha, setPantallaAncha] = useState(true);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(VISTA_PRESUPUESTOS_KEY);
            if (saved === 'filas' || saved === 'columnas') setVista(saved);
        } catch {
            /* SSR / privado */
        }
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 900px)');
        const actualizar = () => setPantallaAncha(mq.matches);
        actualizar();
        mq.addEventListener('change', actualizar);
        return () => mq.removeEventListener('change', actualizar);
    }, []);

    const cambiarVista = (v: VistaPresupuestos) => {
        setVista(v);
        try {
            localStorage.setItem(VISTA_PRESUPUESTOS_KEY, v);
        } catch {
            /* ignore */
        }
    };

    const fetchBudgets = async () => {
        setLoading(true);
        const supabase = createClient();
        let query = supabase.from('budgets').select('*');

        if (filter !== 'todos') query = query.eq('status', filter);
        const nombre = filtroNombre.trim();
        const rif = filtroRif.trim();
        if (nombre) query = query.ilike('customer_name', `%${nombre}%`);
        if (rif) query = query.ilike('customer_rif', `%${rif}%`);
        if (filtroFechaDesde) query = query.gte('created_at', `${filtroFechaDesde}T00:00:00`);
        if (filtroFechaHasta) query = query.lte('created_at', `${filtroFechaHasta}T23:59:59.999`);

        const { data, error } = await query;
        if (!error && data) {
            // Si la migración no se aplicó en la BD todavía, `numero_correlativo` puede no existir.
            // En ese caso asignamos correlativos en memoria empezando en 500 (por fecha asc + id asc).
            const fallbackMap: Record<string, number> = {};
            const needsFallback = data.some((b) => b.numero_correlativo == null);
            if (needsFallback) {
                const ordered = [...data].sort((a, b) => {
                    const da = new Date(a.created_at).getTime();
                    const db = new Date(b.created_at).getTime();
                    if (da !== db) return da - db;
                    return a.id.localeCompare(b.id);
                });
                ordered.forEach((b, idx) => {
                    fallbackMap[b.id] = 500 + idx;
                });
                setFallbackById(fallbackMap);
            }

            const getNumeroOrden = (b: Budget) => {
                const raw = b.numero_correlativo;
                const n =
                    typeof raw === 'number'
                        ? raw
                        : typeof raw === 'string'
                            ? Number(raw)
                            : null;
                if (n != null && !Number.isNaN(n)) return n;
                return fallbackMap[b.id] ?? 500;
            };

            let sorted = [...data];
            if (sortBy === 'fecha') {
                sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            } else {
                sorted.sort((a, b) => getNumeroOrden(a) - getNumeroOrden(b));
            }

            setBudgets(sorted);

            const s = {
                total: sorted.reduce((acc, b) => acc + b.subtotal, 0),
                noEnviado: sorted.filter(b => b.status === 'no_enviado').length,
                enviado: sorted.filter(b => b.status === 'enviado').length,
                aprobados: sorted.filter(b => b.status === 'aprobado').length,
                noAprobados: sorted.filter(b => b.status === 'no_aprobado').length,
                cobrados: sorted.filter(b => b.status === 'cobrado').length,
                pagados: sorted.filter(b => b.status === 'pagado').length,
            };
            setStats(s);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchBudgets();
    }, [filter, sortBy, filtroNombre, filtroRif, filtroFechaDesde, filtroFechaHasta]);

    const hayFiltrosActivos =
        filter !== 'todos' ||
        filtroNombre.trim() !== '' ||
        filtroRif.trim() !== '' ||
        filtroFechaDesde !== '' ||
        filtroFechaHasta !== '';

    const limpiarFiltros = () => {
        setFilter('todos');
        setFiltroNombre('');
        setFiltroRif('');
        setFiltroFechaDesde('');
        setFiltroFechaHasta('');
    };

    const inputFiltroStyle: CSSProperties = {
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '10px 12px',
        color: 'white',
        fontSize: '13px',
        outline: 'none',
    };

    const labelFiltroStyle: CSSProperties = {
        color: 'rgba(255,255,255,0.45)',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        marginBottom: '6px',
        display: 'block',
    };

    const updateStatus = async (id: string, status: ClasificacionPresupuesto) => {
        const supabase = createClient();
        const { error } = await supabase.from('budgets').update({ status }).eq('id', id);
        if (!error) fetchBudgets();
    };

    const deleteBudget = async (id: string) => {
        if (!confirm('¿Seguro que quieres eliminar este presupuesto?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('budgets').delete().eq('id', id);
        if (!error) fetchBudgets();
    };

    const handleShare = (b: Budget) => {
                    const text = `*PRESUPUESTO CASA INTELIGENTE*\nCliente: ${b.customer_name}\nTotal: $${formatUSD(b.subtotal)}\nNro: ${getPresupuestoNumero(b, fallbackById[b.id])}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const glass = {
        background: 'rgba(28, 28, 30, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '110px' }}>
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
                padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 800 }}>Presupuestos</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link href="/presupuesto/demo" target="_blank" rel="noopener noreferrer">
                        <button type="button" style={{
                            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '12px', padding: '10px 14px', fontWeight: 600,
                            fontSize: '12px', cursor: 'pointer'
                        }}>
                            Ver diseño (demo)
                        </button>
                    </Link>
                    <Link href="/ventas">
                        <button style={{
                            background: '#007AFF', color: 'white', border: 'none',
                            borderRadius: '12px', padding: '10px 16px', fontWeight: 700,
                            fontSize: '14px', cursor: 'pointer'
                        }}>
                            + Nuevo
                        </button>
                    </Link>
                </div>
            </div>

            <div style={{ padding: '16px' }}>
                {/* Statistics Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ ...glass, padding: '16px', background: 'linear-gradient(135deg, rgba(0,122,255,0.1) 0%, rgba(0,0,0,0) 100%)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Volumen Total</p>
                        <p style={{ color: 'white', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>${formatUSD(stats.total)}</p>
                    </div>
                    <div style={{ ...glass, padding: '16px', background: 'linear-gradient(135deg, rgba(52,199,89,0.1) 0%, rgba(0,0,0,0) 100%)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Pagados</p>
                        <p style={{ color: '#34C759', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{stats.pagados}</p>
                    </div>
                </div>

                {/* Barra: filtrar + vista + orden */}
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setFiltrosAbiertos(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: hayFiltrosActivos ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.06)',
                            color: hayFiltrosActivos ? '#007AFF' : 'rgba(255,255,255,0.85)',
                            border: hayFiltrosActivos ? '1px solid rgba(0,122,255,0.35)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            padding: '10px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        <span aria-hidden>🔍</span>
                        Filtrar
                        {hayFiltrosActivos ? (
                            <span style={{
                                background: '#007AFF',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 800,
                                borderRadius: '999px',
                                padding: '2px 7px',
                                minWidth: '18px',
                                textAlign: 'center',
                            }}>
                                ●
                            </span>
                        ) : null}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: 0 }}>Vista</p>
                            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => cambiarVista('filas')}
                                    style={{
                                        background: vista === 'filas' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                        color: vista === 'filas' ? 'white' : 'rgba(255,255,255,0.3)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '6px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                    title="Un presupuesto por fila, botones apilados"
                                >
                                    ☰ Filas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => cambiarVista('columnas')}
                                    style={{
                                        background: vista === 'columnas' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                        color: vista === 'columnas' ? 'white' : 'rgba(255,255,255,0.3)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '6px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                    title="Tres presupuestos por fila, todos los botones visibles"
                                >
                                    ⊞ 3 cols
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: 0 }}>Ordenar</p>
                        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setSortBy('fecha')}
                                style={{
                                    background: sortBy === 'fecha' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: sortBy === 'fecha' ? 'white' : 'rgba(255,255,255,0.3)',
                                    border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Fecha
                            </button>
                            <button
                                type="button"
                                onClick={() => setSortBy('nomenclatura')}
                                style={{
                                    background: sortBy === 'nomenclatura' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: sortBy === 'nomenclatura' ? 'white' : 'rgba(255,255,255,0.3)',
                                    border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Nro
                            </button>
                        </div>
                        </div>
                    </div>
                </div>

                <PresupuestosFiltrosModal
                    open={filtrosAbiertos}
                    onClose={() => setFiltrosAbiertos(false)}
                    filter={filter}
                    onFilterChange={setFilter}
                    filtroNombre={filtroNombre}
                    onFiltroNombreChange={setFiltroNombre}
                    filtroRif={filtroRif}
                    onFiltroRifChange={setFiltroRif}
                    filtroFechaDesde={filtroFechaDesde}
                    onFiltroFechaDesdeChange={setFiltroFechaDesde}
                    filtroFechaHasta={filtroFechaHasta}
                    onFiltroFechaHastaChange={setFiltroFechaHasta}
                    hayFiltrosActivos={hayFiltrosActivos}
                    onLimpiar={limpiarFiltros}
                    panelStyle={glass}
                    inputStyle={inputFiltroStyle}
                    labelStyle={labelFiltroStyle}
                />
                {loading ? (
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: '40px' }}>Cargando...</p>
                ) : budgets.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '60px' }}>
                        <p style={{ fontSize: '40px' }}>📄</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: '10px' }}>
                            {hayFiltrosActivos ? 'Ningún presupuesto coincide con los filtros' : 'No hay presupuestos'}
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns:
                                vista === 'filas'
                                    ? '1fr'
                                    : pantallaAncha
                                      ? 'repeat(3, minmax(0, 1fr))'
                                      : '1fr',
                            gap: vista === 'filas' ? '8px' : '10px',
                        }}
                    >
                        {budgets.map((b) => (
                            <TarjetaPresupuesto
                                key={b.id}
                                b={b}
                                vista={vista}
                                fallbackById={fallbackById}
                                glass={glass}
                                onEditar={() => router.push(`/ventas?id=${b.id}`)}
                                onPreview={() =>
                                    window.open(
                                        `/ventas/preview?id=${encodeURIComponent(b.id)}`,
                                        '_blank',
                                        'noopener,noreferrer',
                                    )
                                }
                                onShare={() => handleShare(b)}
                                onDelete={() => deleteBudget(b.id)}
                                onUpdateStatus={(status) => updateStatus(b.id, status)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
