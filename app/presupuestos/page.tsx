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
    cobrado: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'Por Pagar', icon: '💰' },
    pagado: { bg: 'rgba(16,185,129,0.15)', text: '#10B981', label: 'Pagado', icon: '💸' },
};

/** Orden de status para ordenar la lista. */
const STATUS_SORT_ORDER: Record<ClasificacionPresupuesto, number> = {
    no_enviado: 0,
    enviado: 1,
    aprobado: 2,
    no_aprobado: 3,
    cobrado: 4,
    pagado: 5,
};

function clasificarPresupuesto(b: Budget): ClasificacionPresupuesto {
    return b.status;
}

function formatUSD(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFechaCorta(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
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

function getNumeroValor(b: Budget, fallbackById: Record<string, number>) {
    const raw = b.numero_correlativo;
    const n =
        typeof raw === 'number'
            ? raw
            : typeof raw === 'string'
                ? Number(raw)
                : null;
    if (n != null && !Number.isNaN(n)) return n;
    return fallbackById[b.id] ?? 0;
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
    const fecha = formatFechaCorta(b.created_at);
    const numero = getPresupuestoNumero(b, fallbackById[b.id]);
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

    const metaChip: CSSProperties = {
        color: 'rgba(255,255,255,0.55)',
        fontSize: '11px',
        fontWeight: 600,
        margin: 0,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    };

    return (
        <div
            style={{
                ...glass,
                padding: compacto ? '10px' : '12px',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                height: '100%',
            }}
        >
            {/* Orden móvil: Visualizar → Cliente → Nº → Fecha → Status */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                }}
            >
                <button
                    type="button"
                    onClick={onPreview}
                    style={{
                        ...btnBase,
                        padding: '8px 10px',
                        fontSize: '11px',
                        background: 'rgba(0,122,255,0.18)',
                        color: '#5AC8FA',
                        border: '1px solid rgba(90,200,250,0.35)',
                        minHeight: '40px',
                    }}
                    title="Visualizar presupuesto"
                >
                    👁{compacto ? '' : ' Visualizar'}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                        style={{
                            color: 'white',
                            fontSize: compacto ? '14px' : '15px',
                            fontWeight: 700,
                            margin: 0,
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                        title={b.customer_name}
                    >
                        {b.customer_name || 'Sin cliente'}
                    </h3>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                            marginTop: '5px',
                        }}
                    >
                        <p style={metaChip} title="Número de presupuesto">
                            {numero}
                        </p>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>·</span>
                        <p style={{ ...metaChip, fontFamily: 'inherit' }} title="Fecha">
                            {fecha}
                        </p>
                        {b.customer_rif ? (
                            <>
                                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>·</span>
                                <p
                                    style={{
                                        ...metaChip,
                                        fontFamily: 'inherit',
                                        color: 'rgba(255,255,255,0.35)',
                                        fontWeight: 500,
                                    }}
                                    title="Identificación"
                                >
                                    {b.customer_rif}
                                </p>
                            </>
                        ) : null}
                    </div>
                </div>

                <span
                    style={{
                        color: '#34C759',
                        fontSize: compacto ? '13px' : '15px',
                        fontWeight: 800,
                        lineHeight: 1.2,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        paddingTop: '2px',
                    }}
                >
                    ${formatUSD(b.subtotal)}
                </span>
            </div>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                }}
            >
                <label
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: clasifStyle.bg,
                        border: `1px solid ${clasifStyle.text}44`,
                        borderRadius: '999px',
                        padding: '4px 6px 4px 8px',
                        minWidth: 0,
                    }}
                >
                    <span aria-hidden style={{ fontSize: '12px', lineHeight: 1 }}>
                        {clasifStyle.icon}
                    </span>
                    <select
                        aria-label="Status del presupuesto"
                        value={b.status}
                        onChange={(e) => onUpdateStatus(e.target.value as ClasificacionPresupuesto)}
                        style={{
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            background: 'transparent',
                            border: 'none',
                            color: clasifStyle.text,
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 14px 2px 0',
                            outline: 'none',
                            cursor: 'pointer',
                            maxWidth: '160px',
                        }}
                    >
                        {(Object.keys(CLASIFICACION_COLORS) as ClasificacionPresupuesto[]).map((k) => (
                            <option key={k} value={k} style={{ color: '#111', background: '#fff' }}>
                                {CLASIFICACION_COLORS[k].label}
                            </option>
                        ))}
                    </select>
                </label>

                <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
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
                        onClick={onShare}
                        style={{ ...btnAccion, background: 'rgba(52,199,89,0.1)', color: '#34C759' }}
                        title="WhatsApp"
                    >
                        📲
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        style={{ ...btnAccion, background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                        title="Eliminar"
                    >
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PresupuestosPage() {
    const router = useRouter();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'todos' | ClasificacionPresupuesto>('todos');
    const [sortBy, setSortBy] = useState<'fecha' | 'status' | 'nomenclatura'>('fecha');
    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroRif, setFiltroRif] = useState('');
    const [filtroNumero, setFiltroNumero] = useState('');
    const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
    const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
    const [stats, setStats] = useState({
        /** Suma $ de presupuestos aceptados (aprobado + cobrado + pagado). */
        totalAprobado: 0,
        /** Suma $ ya ingresada (cobrado + pagado). */
        totalCobrado: 0,
        /** Suma $ aprobada pendiente de cobro. */
        totalPorCobrar: 0,
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

            const getNumeroOrden = (b: Budget) => getNumeroValor(b, fallbackMap);

            const numeroQ = filtroNumero.trim().toLowerCase().replace(/^p-/, '');
            let filtered = [...data] as Budget[];
            if (numeroQ) {
                filtered = filtered.filter((b) => {
                    const label = getPresupuestoNumero(b, fallbackMap[b.id]).toLowerCase();
                    const valor = String(getNumeroOrden(b));
                    return (
                        label.includes(numeroQ) ||
                        label.includes(`p-${numeroQ}`) ||
                        valor.includes(numeroQ) ||
                        b.id.toLowerCase().includes(numeroQ)
                    );
                });
            }

            let sorted = [...filtered];
            if (sortBy === 'fecha') {
                sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            } else if (sortBy === 'status') {
                sorted.sort((a, b) => {
                    const da = STATUS_SORT_ORDER[a.status] ?? 99;
                    const db = STATUS_SORT_ORDER[b.status] ?? 99;
                    if (da !== db) return da - db;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });
            } else {
                sorted.sort((a, b) => getNumeroOrden(a) - getNumeroOrden(b));
            }

            setBudgets(sorted);

            const sumSubtotal = (pred: (b: Budget) => boolean) =>
                sorted.reduce((acc, b) => (pred(b) ? acc + (Number(b.subtotal) || 0) : acc), 0);

            const s = {
                // Aprobado comercial = aceptado por el cliente (incluye ya cobrados).
                totalAprobado: sumSubtotal((b) =>
                    b.status === 'aprobado' || b.status === 'cobrado' || b.status === 'pagado',
                ),
                // Cobrado = dinero recibido (cobrado y pagado en el flujo actual).
                totalCobrado: sumSubtotal(
                    (b) => b.status === 'cobrado' || b.status === 'pagado',
                ),
                // Por cobrar = aprobado aún sin cobro.
                totalPorCobrar: sumSubtotal((b) => b.status === 'aprobado'),
                noEnviado: sorted.filter((b) => b.status === 'no_enviado').length,
                enviado: sorted.filter((b) => b.status === 'enviado').length,
                aprobados: sorted.filter((b) => b.status === 'aprobado').length,
                noAprobados: sorted.filter((b) => b.status === 'no_aprobado').length,
                cobrados: sorted.filter((b) => b.status === 'cobrado').length,
                pagados: sorted.filter((b) => b.status === 'pagado').length,
            };
            setStats(s);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchBudgets();
    }, [filter, sortBy, filtroNombre, filtroRif, filtroNumero, filtroFechaDesde, filtroFechaHasta]);

    const hayFiltrosActivos =
        filter !== 'todos' ||
        filtroNombre.trim() !== '' ||
        filtroRif.trim() !== '' ||
        filtroNumero.trim() !== '' ||
        filtroFechaDesde !== '' ||
        filtroFechaHasta !== '';

    const limpiarFiltros = () => {
        setFilter('todos');
        setFiltroNombre('');
        setFiltroRif('');
        setFiltroNumero('');
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
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '12px',
            }}>
                <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: 0 }}>Presupuestos</h1>
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
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        justifySelf: 'center',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'end' }}>
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
                {/* KPIs comerciales: aprobado / cobrado / por cobrar */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '10px',
                    marginBottom: '20px',
                }}>
                    <div style={{
                        ...glass,
                        padding: '12px 10px',
                        background: 'linear-gradient(135deg, rgba(52,199,89,0.12) 0%, rgba(0,0,0,0) 100%)',
                    }}>
                        <p style={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            lineHeight: 1.2,
                        }}>
                            Total aprobado
                        </p>
                        <p style={{
                            color: '#34C759',
                            fontSize: '15px',
                            fontWeight: 800,
                            marginTop: '6px',
                            wordBreak: 'break-word',
                        }}>
                            ${formatUSD(stats.totalAprobado)}
                        </p>
                    </div>
                    <div style={{
                        ...glass,
                        padding: '12px 10px',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(0,0,0,0) 100%)',
                    }}>
                        <p style={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            lineHeight: 1.2,
                        }}>
                            Total cobrado
                        </p>
                        <p style={{
                            color: '#F59E0B',
                            fontSize: '15px',
                            fontWeight: 800,
                            marginTop: '6px',
                            wordBreak: 'break-word',
                        }}>
                            ${formatUSD(stats.totalCobrado)}
                        </p>
                    </div>
                    <div style={{
                        ...glass,
                        padding: '12px 10px',
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(0,0,0,0) 100%)',
                    }}>
                        <p style={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            lineHeight: 1.2,
                        }}>
                            Por cobrar
                        </p>
                        <p style={{
                            color: '#EF4444',
                            fontSize: '15px',
                            fontWeight: 800,
                            marginTop: '6px',
                            wordBreak: 'break-word',
                        }}>
                            ${formatUSD(stats.totalPorCobrar)}
                        </p>
                    </div>
                </div>

                {/* Filtro por estado */}
                <div style={{ overflowX: 'auto', marginBottom: '16px', paddingBottom: '2px' }}>
                    <div style={{ display: 'flex', gap: '7px', width: 'max-content' }}>
                        {(['todos', 'no_enviado', 'enviado', 'aprobado', 'no_aprobado', 'cobrado', 'pagado'] as const).map((f) => {
                            const active = filter === f;
                            const chipStyle =
                                f !== 'todos' && active
                                    ? {
                                          bg: CLASIFICACION_COLORS[f].bg,
                                          text: CLASIFICACION_COLORS[f].text,
                                          border: `1px solid ${CLASIFICACION_COLORS[f].text}55`,
                                      }
                                    : {
                                          bg: active ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.04)',
                                          text: active ? '#007AFF' : 'rgba(255,255,255,0.55)',
                                          border: active ? '1px solid rgba(0,122,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                                      };
                            return (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    style={{
                                        background: chipStyle.bg,
                                        color: chipStyle.text,
                                        border: chipStyle.border,
                                        borderRadius: '999px',
                                        padding: '7px 12px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                    }}
                                >
                                    {f !== 'todos' ? <span aria-hidden>{CLASIFICACION_COLORS[f].icon}</span> : null}
                                    {f === 'todos' ? 'Todos' : CLASIFICACION_COLORS[f].label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Barra: vista + orden */}
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
                                onClick={() => setSortBy('status')}
                                style={{
                                    background: sortBy === 'status' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: sortBy === 'status' ? 'white' : 'rgba(255,255,255,0.3)',
                                    border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Status
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
                    filtroNumero={filtroNumero}
                    onFiltroNumeroChange={setFiltroNumero}
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
