'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import PresupuestosFiltrosModal from '@/components/presupuestos/PresupuestosFiltrosModal';
import PresupuestoCobrosModal from '@/components/presupuestos/PresupuestoCobrosModal';
import { fechaDocumentoDeBudget, formatFechaPresupuestoCorta } from '@/lib/presupuesto/fecha';
import { saldoPresupuesto } from '@/lib/presupuesto/cobros';

interface Budget {
    id: string;
    customer_name: string;
    customer_rif: string;
    subtotal: number;
    monto_pagado?: number | null;
    saldo?: number | null;
    status: 'no_enviado' | 'enviado' | 'aprobado' | 'no_aprobado' | 'cobrado' | 'parcialmente_pagado' | 'pagado';
    show_zelle?: boolean;
    numero_correlativo?: number | string | null;
    fecha?: string | null;
    created_at: string;
}

type ClasificacionPresupuesto =
    | 'no_enviado'
    | 'enviado'
    | 'aprobado'
    | 'no_aprobado'
    | 'cobrado'
    | 'parcialmente_pagado'
    | 'pagado';

const CLASIFICACION_COLORS: Record<ClasificacionPresupuesto, { bg: string; text: string; label: string; short: string }> = {
    no_enviado: { bg: '#F1F5F9', text: '#64748B', label: 'No enviado', short: 'Sin env.' },
    enviado: { bg: '#DBEAFE', text: '#1D4ED8', label: 'Enviado', short: 'Enviado' },
    aprobado: { bg: '#DCFCE7', text: '#15803D', label: 'Aprobado', short: 'Aprobado' },
    no_aprobado: { bg: '#FEE2E2', text: '#B91C1C', label: 'No aprobado', short: 'Rechaz.' },
    cobrado: { bg: '#FEF3C7', text: '#B45309', label: 'Por Pagar', short: 'Por pagar' },
    parcialmente_pagado: { bg: '#FFEDD5', text: '#C2410C', label: 'Parcial', short: 'Parcial' },
    pagado: { bg: '#D1FAE5', text: '#047857', label: 'Pagado', short: 'Pagado' },
};

/** Orden de status para ordenar la lista. */
const STATUS_SORT_ORDER: Record<ClasificacionPresupuesto, number> = {
    no_enviado: 0,
    enviado: 1,
    aprobado: 2,
    no_aprobado: 3,
    cobrado: 4,
    parcialmente_pagado: 5,
    pagado: 6,
};

function clasificarPresupuesto(b: Budget): ClasificacionPresupuesto {
    return b.status;
}

function formatUSD(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function montoPagadoDe(b: Budget) {
    if (b.monto_pagado != null && Number.isFinite(Number(b.monto_pagado))) return Number(b.monto_pagado);
    return b.status === 'pagado' ? Number(b.subtotal) || 0 : 0;
}

function saldoDe(b: Budget) {
    if (b.saldo != null && Number.isFinite(Number(b.saldo))) return Number(b.saldo);
    return saldoPresupuesto(Number(b.subtotal) || 0, montoPagadoDe(b));
}

function formatFechaCorta(iso: string) {
    return formatFechaPresupuestoCorta(iso);
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

function TarjetaPresupuesto({
    b,
    fallbackById,
    glass,
    onEditar,
    onPreview,
    onShare,
    onDelete,
    onUpdateStatus,
    onAbono,
}: {
    b: Budget;
    fallbackById: Record<string, number>;
    glass: CSSProperties;
    onEditar: () => void;
    onPreview: () => void;
    onShare: () => void;
    onDelete: () => void;
    onUpdateStatus: (status: ClasificacionPresupuesto) => void;
    onAbono: () => void;
}) {
    const [menuAbierto, setMenuAbierto] = useState(false);
    const clasif = clasificarPresupuesto(b);
    const clasifStyle = CLASIFICACION_COLORS[clasif];
    const fecha = formatFechaCorta(b.fecha || b.created_at);
    const numero = getPresupuestoNumero(b, fallbackById[b.id]);

    return (
        <div
            className="presupuesto-tarjeta"
            style={{
                ...glass,
                padding: '14px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                minWidth: 0,
                overflow: 'hidden',
            }}
        >
            {/* Cabecera tappable → visualizar */}
            <button
                type="button"
                onClick={onPreview}
                className="presupuesto-tarjeta-main"
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                    width: '100%',
                    minWidth: 0,
                    padding: 0,
                    margin: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                }}
            >
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                        style={{
                            color: '#0F172A',
                            fontSize: '16px',
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
                    <p
                        style={{
                            color: '#64748B',
                            fontSize: '12px',
                            fontWeight: 600,
                            margin: '5px 0 0',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        }}
                    >
                        {numero}
                        <span style={{ color: '#CBD5E1', margin: '0 6px' }}>·</span>
                        <span style={{ fontFamily: 'inherit', fontWeight: 500 }}>{fecha}</span>
                    </p>
                </div>
                <span
                    className="presupuesto-tarjeta-monto"
                    style={{
                        color: '#15803D',
                        fontSize: '17px',
                        fontWeight: 800,
                        lineHeight: 1.2,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        paddingTop: '1px',
                    }}
                >
                    ${formatUSD(b.subtotal)}
                </span>
            </button>
            {montoPagadoDe(b) > 0 || b.status === 'parcialmente_pagado' ? (
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            height: '6px',
                            borderRadius: '999px',
                            background: '#E2E8F0',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                width: `${Math.min(100, ((montoPagadoDe(b) / Math.max(Number(b.subtotal) || 1, 1)) * 100))}%`,
                                height: '100%',
                                background: saldoDe(b) <= 0 ? '#10B981' : '#F59E0B',
                            }}
                        />
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '11px', fontWeight: 600, color: '#64748B' }}>
                        Abonado ${formatUSD(montoPagadoDe(b))} · Saldo ${formatUSD(saldoDe(b))}
                    </p>
                </div>
            ) : null}

            {/* Status + acciones mínimas */}
            <div
                className="presupuesto-tarjeta-actions"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: 0,
                    width: '100%',
                }}
            >
                <label
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: clasifStyle.bg,
                        border: `1px solid ${clasifStyle.text}44`,
                        borderRadius: '999px',
                        padding: '5px 10px 5px 12px',
                        minWidth: 0,
                        flex: '0 1 auto',
                    }}
                >
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
                            fontSize: '12px',
                            fontWeight: 700,
                            padding: '0 12px 0 0',
                            outline: 'none',
                            cursor: 'pointer',
                            maxWidth: '140px',
                        }}
                    >
                        {(Object.keys(CLASIFICACION_COLORS) as ClasificacionPresupuesto[]).map((k) => (
                            <option key={k} value={k} style={{ color: '#111', background: '#fff' }}>
                                {CLASIFICACION_COLORS[k].label}
                            </option>
                        ))}
                    </select>
                </label>

                <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', position: 'relative' }}>
                    <button
                        type="button"
                        onClick={onAbono}
                        style={{
                            border: 'none',
                            borderRadius: '10px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: '#D1FAE5',
                            color: '#047857',
                        }}
                    >
                        Abono
                    </button>
                    <button
                        type="button"
                        onClick={onEditar}
                        style={{
                            border: 'none',
                            borderRadius: '10px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: '#DBEAFE',
                            color: '#1D4ED8',
                        }}
                    >
                        Editar
                    </button>
                    <button
                        type="button"
                        onClick={() => setMenuAbierto((v) => !v)}
                        aria-expanded={menuAbierto}
                        aria-haspopup="menu"
                        aria-label="Más acciones"
                        style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: '10px',
                            width: '36px',
                            height: '36px',
                            fontSize: '16px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: '#FFFFFF',
                            color: '#334155',
                            lineHeight: 1,
                        }}
                    >
                        ···
                    </button>
                    {menuAbierto ? (
                        <div
                            role="menu"
                            style={{
                                position: 'absolute',
                                right: 0,
                                bottom: 'calc(100% + 6px)',
                                zIndex: 30,
                                minWidth: '160px',
                                background: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                borderRadius: '12px',
                                padding: '6px',
                                boxShadow: '0 12px 28px rgba(15,23,42,0.12)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                            }}
                        >
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuAbierto(false);
                                    onAbono();
                                }}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#047857',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Registrar abono
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuAbierto(false);
                                    onPreview();
                                }}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#0F172A',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Ver documento
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuAbierto(false);
                                    onShare();
                                }}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#15803D',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                WhatsApp
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuAbierto(false);
                                    onDelete();
                                }}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#DC2626',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Eliminar
                            </button>
                        </div>
                    ) : null}
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
        /** Suma $ de presupuestos aceptados (aprobado + por pagar + pagado). */
        totalAprobado: 0,
        /** Suma $ ya ingresada (solo pagado). */
        totalPagado: 0,
        /** Suma $ aceptada aún sin pago (aprobado + por pagar). */
        totalPorPagar: 0,
        noEnviado: 0,
        enviado: 0,
        aprobados: 0,
        noAprobados: 0,
        porPagar: 0,
        pagados: 0,
    });
    const [fallbackById, setFallbackById] = useState<Record<string, number>>({});
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
    const [cobroId, setCobroId] = useState<string | null>(null);

    const fetchBudgets = async () => {
        setLoading(true);
        const supabase = createClient();
        let query = supabase.from('budgets').select('*');

        if (filter !== 'todos') query = query.eq('status', filter);
        const nombre = filtroNombre.trim();
        const rif = filtroRif.trim();
        if (nombre) query = query.ilike('customer_name', `%${nombre}%`);
        if (rif) query = query.ilike('customer_rif', `%${rif}%`);

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
            if (filtroFechaDesde || filtroFechaHasta) {
                filtered = filtered.filter((b) => {
                    const f = fechaDocumentoDeBudget(b);
                    if (filtroFechaDesde && f < filtroFechaDesde) return false;
                    if (filtroFechaHasta && f > filtroFechaHasta) return false;
                    return true;
                });
            }
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
                sorted.sort((a, b) => fechaDocumentoDeBudget(b).localeCompare(fechaDocumentoDeBudget(a)));
            } else if (sortBy === 'status') {
                sorted.sort((a, b) => {
                    const da = STATUS_SORT_ORDER[a.status] ?? 99;
                    const db = STATUS_SORT_ORDER[b.status] ?? 99;
                    if (da !== db) return da - db;
                    return fechaDocumentoDeBudget(b).localeCompare(fechaDocumentoDeBudget(a));
                });
            } else {
                sorted.sort((a, b) => getNumeroOrden(a) - getNumeroOrden(b));
            }

            setBudgets(sorted);

            const sumSubtotal = (pred: (b: Budget) => boolean) =>
                sorted.reduce((acc, b) => (pred(b) ? acc + (Number(b.subtotal) || 0) : acc), 0);

            const s = {
                totalAprobado: sumSubtotal((b) =>
                    b.status === 'aprobado' ||
                    b.status === 'cobrado' ||
                    b.status === 'parcialmente_pagado' ||
                    b.status === 'pagado',
                ),
                totalPagado: sorted.reduce((acc, b) => acc + montoPagadoDe(b), 0),
                totalPorPagar: sorted.reduce((acc, b) => {
                    if (b.status === 'no_aprobado') return acc;
                    return acc + saldoDe(b);
                }, 0),
                noEnviado: sorted.filter((b) => b.status === 'no_enviado').length,
                enviado: sorted.filter((b) => b.status === 'enviado').length,
                aprobados: sorted.filter((b) => b.status === 'aprobado').length,
                noAprobados: sorted.filter((b) => b.status === 'no_aprobado').length,
                porPagar: sorted.filter((b) => b.status === 'cobrado' || b.status === 'parcialmente_pagado').length,
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
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '10px',
        padding: '10px 12px',
        color: '#0F172A',
        fontSize: '13px',
        outline: 'none',
    };

    const labelFiltroStyle: CSSProperties = {
        color: '#64748B',
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
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '20px',
        boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
    };

    return (
        <div
            className="presupuestos-page"
            style={{
                minHeight: '100vh',
                background: '#F3F4F6',
                paddingBottom: '110px',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                overflowX: 'hidden',
            }}
        >
            <div
                className="presupuestos-header"
                style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
                padding: '14px 16px', borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
            }}>
                <h1 className="presupuestos-title" style={{ color: '#0F172A', fontSize: '22px', fontWeight: 800, margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Presupuestos</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                        type="button"
                        onClick={() => setFiltrosAbiertos(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: hayFiltrosActivos ? 'rgba(0,122,255,0.12)' : '#FFFFFF',
                            color: hayFiltrosActivos ? '#007AFF' : '#334155',
                            border: hayFiltrosActivos ? '1px solid rgba(0,122,255,0.35)' : '1px solid #E2E8F0',
                            borderRadius: '10px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Filtrar
                        {hayFiltrosActivos ? (
                            <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '999px',
                                background: '#007AFF',
                                display: 'inline-block',
                            }} />
                        ) : null}
                    </button>
                    <Link href="/ventas">
                        <button style={{
                            background: '#007AFF', color: 'white', border: 'none',
                            borderRadius: '10px', padding: '8px 12px', fontWeight: 700,
                            fontSize: '12px', cursor: 'pointer'
                        }}>
                            + Nuevo
                        </button>
                    </Link>
                </div>
            </div>

            <div
                className="presupuestos-body"
                style={{
                    padding: '16px',
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflowX: 'hidden',
                }}
            >
                {/* KPIs compactos */}
                <div
                    className="presupuestos-kpis"
                    style={{
                        ...glass,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '0',
                        marginBottom: '14px',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '12px 4px',
                        overflow: 'hidden',
                    }}
                >
                    {[
                        { label: 'Aprobado', value: `$${formatUSD(stats.totalAprobado)}`, color: '#34C759' },
                        { label: 'Por pagar', value: `$${formatUSD(stats.totalPorPagar)}`, color: '#F59E0B' },
                        { label: 'Pagado', value: `$${formatUSD(stats.totalPagado)}`, color: '#10B981' },
                    ].map((kpi, i) => (
                        <div
                            key={kpi.label}
                            style={{
                                padding: '0 10px',
                                minWidth: 0,
                                borderLeft: i === 0 ? 'none' : '1px solid #E2E8F0',
                            }}
                        >
                            <p style={{
                                color: '#94A3B8',
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                margin: 0,
                            }}>
                                {kpi.label}
                            </p>
                            <p style={{
                                color: kpi.color,
                                fontSize: '15px',
                                fontWeight: 800,
                                margin: '4px 0 0',
                                wordBreak: 'break-word',
                            }}>
                                {kpi.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Filtro por estado: dos líneas justificadas (sin scroll lateral) */}
                <div
                    className="presupuestos-status-filters"
                    role="listbox"
                    aria-label="Filtrar por status"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        marginBottom: '14px',
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                    }}
                >
                    {([
                        ['todos', 'no_enviado', 'enviado', 'aprobado'],
                        ['no_aprobado', 'cobrado', 'parcialmente_pagado', 'pagado'],
                    ] as const).map((row, rowIdx) => (
                        <div
                            key={rowIdx}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'stretch',
                                gap: '6px',
                                width: '100%',
                                minWidth: 0,
                            }}
                        >
                            {row.map((f) => {
                                const active = filter === f;
                                const label = f === 'todos' ? 'Todos' : CLASIFICACION_COLORS[f].short;
                                const text =
                                    f !== 'todos' && active
                                        ? CLASIFICACION_COLORS[f].text
                                        : active
                                          ? '#007AFF'
                                          : '#475569';
                                const bg =
                                    f !== 'todos' && active
                                        ? CLASIFICACION_COLORS[f].bg
                                        : active
                                          ? '#DBEAFE'
                                          : '#FFFFFF';
                                const border =
                                    f !== 'todos' && active
                                        ? `1px solid ${CLASIFICACION_COLORS[f].text}55`
                                        : active
                                          ? '1px solid rgba(0,122,255,0.35)'
                                          : '1px solid #E2E8F0';
                                return (
                                    <button
                                        key={f}
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        aria-label={f === 'todos' ? 'Todos' : CLASIFICACION_COLORS[f].label}
                                        onClick={() => setFilter(f)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flex: '1 1 0',
                                            width: 0,
                                            minWidth: 0,
                                            boxSizing: 'border-box',
                                            background: bg,
                                            color: text,
                                            border,
                                            borderRadius: '999px',
                                            padding: '9px 4px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            lineHeight: 1.15,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <PresupuestosFiltrosModal
                    open={filtrosAbiertos}
                    onClose={() => setFiltrosAbiertos(false)}
                    filter={filter}
                    onFilterChange={setFilter}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
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
                    <p style={{ textAlign: 'center', color: '#94A3B8', marginTop: '40px' }}>Cargando...</p>
                ) : budgets.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '60px' }}>
                        <p style={{ color: '#64748B', fontSize: '15px', fontWeight: 600 }}>
                            {hayFiltrosActivos ? 'Ningún presupuesto coincide con los filtros' : 'No hay presupuestos'}
                        </p>
                    </div>
                ) : (
                    <div
                        className="presupuestos-lista"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr)',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                    >
                        {budgets.map((b) => (
                            <TarjetaPresupuesto
                                key={b.id}
                                b={b}
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
                                onAbono={() => setCobroId(b.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
            <PresupuestoCobrosModal
                open={Boolean(cobroId)}
                budgetId={cobroId}
                customerName={budgets.find((x) => x.id === cobroId)?.customer_name}
                onClose={() => setCobroId(null)}
                onChanged={() => void fetchBudgets()}
            />
        </div>
    );
}
