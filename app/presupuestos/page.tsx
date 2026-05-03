'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

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

export default function PresupuestosPage() {
    const router = useRouter();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'todos' | ClasificacionPresupuesto>('todos');
    const [sortBy, setSortBy] = useState<'fecha' | 'nomenclatura'>('fecha');
    const [searchTerm, setSearchTerm] = useState('');
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

    const fetchBudgets = async () => {
        setLoading(true);
        const supabase = createClient();
        let query = supabase.from('budgets').select('*');

        if (filter !== 'todos') query = query.eq('status', filter);

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

            if (searchTerm) {
                sorted = sorted.filter(b =>
                    b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    b.customer_rif.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    getPresupuestoNumero(b, fallbackMap[b.id]).toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            setBudgets(sorted);

            // Calculate stats from all data
            const s = {
                total: data.reduce((acc, b) => acc + b.subtotal, 0),
                noEnviado: data.filter(b => b.status === 'no_enviado').length,
                enviado: data.filter(b => b.status === 'enviado').length,
                aprobados: data.filter(b => b.status === 'aprobado').length,
                noAprobados: data.filter(b => b.status === 'no_aprobado').length,
                cobrados: data.filter(b => b.status === 'cobrado').length,
                pagados: data.filter(b => b.status === 'pagado').length,
            };
            setStats(s);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchBudgets();
    }, [filter, sortBy, searchTerm]);

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

                {/* Search and Sort Bar */}
                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ ...glass, padding: '12px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                            Clasificación de presupuestos
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {(Object.keys(CLASIFICACION_COLORS) as ClasificacionPresupuesto[]).map((k) => (
                                <span
                                    key={k}
                                    style={{
                                        ...CLASIFICACION_COLORS[k],
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '4px 10px',
                                        borderRadius: '999px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }}
                                >
                                    <span>{CLASIFICACION_COLORS[k].icon}</span>
                                    <span>{CLASIFICACION_COLORS[k].label}</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Buscar por cliente, RIF o Nro..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                padding: '12px 16px',
                                color: 'white',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                            {(['todos', 'no_enviado', 'enviado', 'aprobado', 'no_aprobado', 'cobrado', 'pagado'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    style={{
                                        background: filter === f ? 'rgba(0,122,255,0.15)' : 'transparent',
                                        color: filter === f ? '#007AFF' : 'rgba(255,255,255,0.4)',
                                        border: filter === f ? '1px solid rgba(0,122,255,0.3)' : '1px solid transparent',
                                        borderRadius: '10px', padding: '6px 14px',
                                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {f === 'todos'
                                        ? 'Todos'
                                        : f === 'no_enviado'
                                            ? 'No enviado'
                                            : f === 'enviado'
                                                ? 'Enviado'
                                                : f === 'aprobado'
                                                    ? 'Aprobado'
                                                    : f === 'no_aprobado'
                                                        ? 'No aprobado'
                                                        : f === 'cobrado'
                                                            ? 'Cobrado'
                                                            : 'Pagado'}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px' }}>
                            <button
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

                {loading ? (
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: '40px' }}>Cargando...</p>
                ) : budgets.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '60px' }}>
                        <p style={{ fontSize: '40px' }}>📄</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: '10px' }}>No hay presupuestos</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {budgets.map(b => (
                            <div key={b.id} style={{ ...glass, padding: '16px', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <h3 style={{ color: 'white', fontSize: '17px', fontWeight: 700 }}>
                                                {b.customer_name}
                                            </h3>
                                        </div>
                                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' }}>
                                            {b.customer_rif} · <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{getPresupuestoNumero(b, fallbackById[b.id])}</span>
                                        </p>
                                        <div style={{
                                            ...CLASIFICACION_COLORS[clasificarPresupuesto(b)],
                                            marginTop: '6px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            width: 'fit-content'
                                        }}>
                                            <span>{CLASIFICACION_COLORS[clasificarPresupuesto(b)].icon}</span>
                                            <span>{CLASIFICACION_COLORS[clasificarPresupuesto(b)].label}</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ color: '#34C759', fontSize: '20px', fontWeight: 800 }}>${formatUSD(b.subtotal)}</p>
                                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
                                            {new Date(b.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex', gap: '8px', marginTop: '16px',
                                    borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px'
                                }}>
                                    <button
                                        onClick={() => router.push(`/ventas?id=${b.id}`)}
                                        style={{
                                            flex: 1.5, background: 'rgba(0,122,255,0.1)', color: '#007AFF',
                                            border: 'none', borderRadius: '10px', padding: '10px',
                                            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                    >
                                        ✏️ Editar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            window.open(
                                                `/ventas/preview?id=${encodeURIComponent(b.id)}`,
                                                '_blank',
                                                'noopener,noreferrer',
                                            )
                                        }
                                        style={{
                                            minWidth: '44px', background: 'rgba(88,86,214,0.12)', color: '#A78BFA',
                                            border: 'none', borderRadius: '10px', padding: '10px',
                                            fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                        title="Vista previa del documento"
                                    >
                                        📄
                                    </button>
                                    <button
                                        onClick={() => handleShare(b)}
                                        style={{
                                            width: '44px', background: 'rgba(52,199,89,0.1)', color: '#34C759',
                                            border: 'none', borderRadius: '10px', padding: '10px',
                                            fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                        title="Compartir por WhatsApp"
                                    >
                                        📲
                                    </button>
                                    <button
                                        onClick={() => deleteBudget(b.id)}
                                        style={{
                                            width: '44px', background: 'rgba(255,59,48,0.1)', color: '#FF3B30',
                                            border: 'none', borderRadius: '10px', padding: '10px',
                                            fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                        title="Eliminar"
                                    >
                                        🗑️
                                    </button>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    gap: '6px',
                                    marginTop: '10px',
                                    flexWrap: 'wrap',
                                }}>
                                    {(Object.keys(CLASIFICACION_COLORS) as ClasificacionPresupuesto[]).map((k) => {
                                        const active = b.status === k;
                                        return (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => updateStatus(b.id, k)}
                                                style={{
                                                    background: active ? CLASIFICACION_COLORS[k].bg : 'rgba(255,255,255,0.04)',
                                                    color: active ? CLASIFICACION_COLORS[k].text : 'rgba(255,255,255,0.65)',
                                                    border: active ? `1px solid ${CLASIFICACION_COLORS[k].text}55` : '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '999px',
                                                    padding: '6px 10px',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                }}
                                            >
                                                <span>{CLASIFICACION_COLORS[k].icon}</span>
                                                <span>{CLASIFICACION_COLORS[k].label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
