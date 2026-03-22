'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Movement {
    id: string;
    material_id: string;
    movement_type_code: string;
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reason: string | null;
    notes: string | null;
    performed_by: string | null;
    created_at: string;
    global_inventory?: { name: string; unit: string; sap_code: string | null };
}

const MOVE_TYPE: Record<string, { label: string; color: string; emoji: string; sign: string }> = {
    '101': { label: 'Entrada Compra',    color: '#34C759', emoji: '📥', sign: '+' },
    '201': { label: 'Salida / Venta',    color: '#FF3B30', emoji: '📤', sign: '-' },
    '311': { label: 'Ajuste Inventario', color: '#FFD60A', emoji: '🔄', sign: '±' },
    '501': { label: 'Entrada Devolución',color: '#00AEEF', emoji: '↩️', sign: '+' },
    '601': { label: 'Baja / Merma',      color: '#FF9500', emoji: '🗑️', sign: '-' },
};

function getMovType(code: string, reason: string | null) {
    if (reason === 'compra' || reason === 'devolución') return MOVE_TYPE['101'];
    if (reason === 'venta' || reason === 'merma' || reason === 'pérdida') return MOVE_TYPE['201'];
    if (reason === 'ajuste') return MOVE_TYPE['311'];
    return MOVE_TYPE[code] ?? { label: 'Movimiento', color: '#8E8E93', emoji: '📦', sign: '±' };
}

function usd(v: number) { return `$${Number(v).toFixed(2)}`; }

function KardexContent() {
    const searchParams = useSearchParams();
    const preFilter = searchParams.get('item');

    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<{ id: string; name: string; sap_code: string | null }[]>([]);
    const [filterItem, setFilterItem] = useState(preFilter ?? 'all');
    const [filterType, setFilterType] = useState('all');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 30;

    const fetchData = useCallback(async () => {
        const supabase = createClient();
        setLoading(true);

        // Fetch products for filter dropdown
        const { data: prods } = await supabase.from('global_inventory').select('id,name,sap_code').order('name');
        setProducts(prods ?? []);

        // Fetch movements with join
        let query = supabase
            .from('inventory_movements')
            .select('*, global_inventory(name,unit,sap_code)')
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (filterItem !== 'all') query = query.eq('material_id', filterItem);
        if (filterType !== 'all') query = query.eq('movement_type_code', filterType);

        const { data } = await query;
        setMovements((data as Movement[]) ?? []);
        setLoading(false);
    }, [filterItem, filterType, page]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const glass = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', backdropFilter: 'blur(20px)' };

    return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', padding: '20px', paddingBottom: '80px' }}>
            <style>{`
                * { box-sizing:border-box; }
                select { -webkit-appearance:none; appearance:none; }
                @keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.4;} }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <Link href="/almacen" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontWeight: 600 }}>← Inventario</Link>
                    <h1 style={{ margin: '6px 0 0 0', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.5px' }}>Kardex Global</h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>Historial completo de movimientos de stock</p>
                </div>
                <Link href="/almacen/nuevo">
                    <button style={{ padding: '12px 20px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg,#FFD60A,#FF9500)', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900, fontSize: '13px' }}>
                        + Nuevo Item
                    </button>
                </Link>
            </div>

            {/* Filters */}
            <div style={{ ...glass, padding: '16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: '1 1 220px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Producto</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={filterItem}
                            onChange={e => { setFilterItem(e.target.value); setPage(0); }}
                            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontFamily: 'inherit', fontWeight: 600, fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="all" style={{ background: '#111' }}>Todos los productos</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id} style={{ background: '#111' }}>
                                    {p.sap_code ? `[${p.sap_code}] ` : ''}{p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ flex: '0 1 180px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Tipo</label>
                    <select
                        value={filterType}
                        onChange={e => { setFilterType(e.target.value); setPage(0); }}
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontFamily: 'inherit', fontWeight: 600, fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="all" style={{ background: '#111' }}>Todos</option>
                        {Object.entries(MOVE_TYPE).map(([code, mt]) => (
                            <option key={code} value={code} style={{ background: '#111' }}>{mt.emoji} {mt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Movements table */}
            <div style={{ ...glass, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                {['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Stock', 'Motivo / Notas', 'Usuario'].map(h => (
                                    <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i}>
                                        <td colSpan={7} style={{ padding: '20px 16px' }}>
                                            <div style={{ height: '16px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', animation: 'pulse 1.5s ease infinite' }} />
                                        </td>
                                    </tr>
                                ))
                            ) : movements.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '14px', fontWeight: 600 }}>
                                        No hay movimientos registrados
                                    </td>
                                </tr>
                            ) : (
                                movements.map(m => {
                                    const mt = getMovType(m.movement_type_code, m.reason);
                                    const isPositive = m.new_stock >= m.previous_stock;
                                    const date = new Date(m.created_at);

                                    return (
                                        <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                            {/* Date */}
                                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                                <p style={{ margin: '0 0 2px 0', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                                                    {date.toLocaleDateString('es-VE')}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
                                                    {date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>
                                            {/* Product */}
                                            <td style={{ padding: '14px 16px', maxWidth: '200px' }}>
                                                <p style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {m.global_inventory?.name ?? '—'}
                                                </p>
                                                {m.global_inventory?.sap_code && (
                                                    <p style={{ margin: 0, fontSize: '10px', color: '#00AEEF', fontWeight: 700 }}>{m.global_inventory.sap_code}</p>
                                                )}
                                            </td>
                                            {/* Type */}
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: mt.color + '15', border: `1px solid ${mt.color}30` }}>
                                                    <span style={{ fontSize: '12px' }}>{mt.emoji}</span>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: mt.color, whiteSpace: 'nowrap' }}>{mt.label}</span>
                                                </div>
                                            </td>
                                            {/* Quantity */}
                                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                <span style={{ fontSize: '16px', fontWeight: 900, color: isPositive ? '#34C759' : '#FF3B30' }}>
                                                    {isPositive ? '+' : '-'}{m.quantity}
                                                </span>
                                                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                                                    {m.global_inventory?.unit ?? 'UND'}
                                                </p>
                                            </td>
                                            {/* Stock */}
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>
                                                    <span>{m.previous_stock}</span>
                                                    <span style={{ fontSize: '10px' }}>→</span>
                                                    <span style={{ fontWeight: 800, color: 'white' }}>{m.new_stock}</span>
                                                </div>
                                            </td>
                                            {/* Notes */}
                                            <td style={{ padding: '14px 16px', maxWidth: '200px' }}>
                                                {m.reason && (
                                                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize', display: 'inline-block', marginBottom: '3px' }}>
                                                        {m.reason}
                                                    </span>
                                                )}
                                                {m.notes && (
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.notes}</p>
                                                )}
                                                {!m.reason && !m.notes && <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px' }}>—</span>}
                                            </td>
                                            {/* User */}
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>{m.performed_by ?? 'Sistema'}</span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {movements.length === PAGE_SIZE && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: page === 0 ? 'rgba(255,255,255,0.2)' : 'white', cursor: page === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '12px' }}>
                            ← Anterior
                        </button>
                        <span style={{ padding: '8px 14px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, alignSelf: 'center' }}>Pág. {page + 1}</span>
                        <button onClick={() => setPage(p => p + 1)} style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '12px' }}>
                            Siguiente →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function KardexPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter,sans-serif' }}>Cargando Kardex…</div>}>
            <KardexContent />
        </Suspense>
    );
}
