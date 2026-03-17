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
    status: 'pendiente' | 'aprobado' | 'rechazado' | 'archivado';
    show_zelle?: boolean;
    created_at: string;
}

const STATUS_COLORS = {
    pendiente: { bg: 'rgba(255,149,0,0.15)', text: '#FF9500', label: 'Pendiente', icon: '⏳' },
    aprobado: { bg: 'rgba(52,199,89,0.15)', text: '#34C759', label: 'Aprobado', icon: '✅' },
    rechazado: { bg: 'rgba(255,59,48,0.15)', text: '#FF3B30', label: 'Rechazado', icon: '❌' },
    archivado: { bg: 'rgba(142,142,147,0.15)', text: '#8E8E93', label: 'Archivado', icon: '📁' },
};

function formatUSD(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PresupuestosPage() {
    const router = useRouter();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'todos' | 'pendiente' | 'archivado'>('todos');
    const [sortBy, setSortBy] = useState<'fecha' | 'nomenclatura'>('fecha');
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

    const fetchBudgets = async () => {
        setLoading(true);
        const supabase = createClient();
        let query = supabase.from('budgets').select('*');

        if (filter === 'pendiente') query = query.eq('status', 'pendiente');
        if (filter === 'archivado') query = query.eq('status', 'archivado');

        const { data, error } = await query;
        if (!error && data) {
            let sorted = [...data];
            if (sortBy === 'fecha') {
                sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            } else {
                sorted.sort((a, b) => a.id.localeCompare(b.id));
            }

            if (searchTerm) {
                sorted = sorted.filter(b =>
                    b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    b.customer_rif.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    `P-${b.id.slice(0, 8)}`.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            setBudgets(sorted);

            // Calculate stats from all data
            const s = {
                total: data.reduce((acc, b) => acc + b.subtotal, 0),
                pending: data.filter(b => b.status === 'pendiente').length,
                approved: data.filter(b => b.status === 'aprobado').length,
                rejected: data.filter(b => b.status === 'rechazado').length,
            };
            setStats(s);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchBudgets();
    }, [filter, sortBy, searchTerm]);

    const updateStatus = async (id: string, status: string) => {
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
        const text = `*PRESUPUESTO CASA INTELIGENTE*\nCliente: ${b.customer_name}\nTotal: $${formatUSD(b.subtotal)}\nNro: P-${b.id.slice(0, 8).toUpperCase()}`;
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

            <div style={{ padding: '16px' }}>
                {/* Statistics Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ ...glass, padding: '16px', background: 'linear-gradient(135deg, rgba(0,122,255,0.1) 0%, rgba(0,0,0,0) 100%)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Volumen Total</p>
                        <p style={{ color: 'white', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>${formatUSD(stats.total)}</p>
                    </div>
                    <div style={{ ...glass, padding: '16px', background: 'linear-gradient(135deg, rgba(52,199,89,0.1) 0%, rgba(0,0,0,0) 100%)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Aprobados</p>
                        <p style={{ color: '#34C759', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{stats.approved}</p>
                    </div>
                </div>

                {/* Search and Sort Bar */}
                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                            {['todos', 'pendiente', 'archivado'].map((f: any) => (
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
                                    {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Pendientes' : 'Archivados'}
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
                                            {b.customer_rif} · <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>P-{new String(b.id).slice(0, 8).toUpperCase()}</span>
                                        </p>
                                        <div style={{
                                            ...STATUS_COLORS[b.status],
                                            fontSize: '11px', fontWeight: 700, padding: '4px 10px',
                                            borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content'
                                        }}>
                                            <span>{STATUS_COLORS[b.status].icon}</span>
                                            <span>{STATUS_COLORS[b.status].label}</span>
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
                                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                                    <button
                                        onClick={() => updateStatus(b.id, b.status === 'archivado' ? 'pendiente' : 'archivado')}
                                        style={{
                                            width: '44px', background: 'rgba(255,255,255,0.05)', color: 'white',
                                            border: 'none', borderRadius: '10px', padding: '10px',
                                            fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                        title={b.status === 'archivado' ? 'Desarchivar' : 'Archivar'}
                                    >
                                        {b.status === 'archivado' ? '📁' : '📦'}
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
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
