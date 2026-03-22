'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────
interface Product {
    id: string;
    sap_code: string | null;
    name: string;
    category_name: string;
    unit: string;
    stock_available: number;
    stock_quarantine: number;
    reorder_point: number;
    alert_threshold: number;
    average_weighted_cost: number;
    location: string | null;
    image_url: string | null;
    last_purchase_date: string | null;
    last_purchase_price: number | null;
    supplier_name: string | null;
    is_active: boolean;
}

// ── Helpers ────────────────────────────────────────────────────
const usd = (v: number) => new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

function stockStatus(item: Product): 'critical' | 'low' | 'ok' {
    if (item.stock_available <= 0) return 'critical';
    if (item.stock_available <= item.reorder_point) return 'low';
    return 'ok';
}

const STATUS = {
    critical: { label: 'SIN STOCK',    color: '#FF3B30', bg: 'rgba(255,59,48,0.12)',  border: 'rgba(255,59,48,0.3)',  dot: '#FF3B30' },
    low:      { label: 'STOCK BAJO',   color: '#FF9500', bg: 'rgba(255,149,0,0.10)',  border: 'rgba(255,149,0,0.3)',  dot: '#FF9500' },
    ok:       { label: 'NORMAL',        color: '#34C759', bg: 'rgba(52,199,89,0.08)', border: 'rgba(52,199,89,0.25)', dot: '#34C759' },
};

const CATS = ['Todos', 'Domótica', 'Seguridad', 'Iluminación', 'Sensores', 'Automatización', 'Herramientas', 'Otros'];

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ label, value, sub, color, emoji }: { label: string; value: string | number; sub?: string; color: string; emoji: string }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '22px', backdropFilter: 'blur(20px)' }}>
            <div style={{ fontSize: '26px', marginBottom: '10px' }}>{emoji}</div>
            <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</p>
            <p style={{ margin: 0, fontSize: '26px', fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
            {sub && <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{sub}</p>}
        </div>
    );
}

// ── Adjustment Modal ───────────────────────────────────────────
function AdjustModal({ item, onClose, onSaved }: { item: Product; onClose: () => void; onSaved: () => void }) {
    const [qty, setQty] = useState<number>(0);
    const [reason, setReason] = useState('ajuste');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        if (qty === 0) return;
        setSaving(true);
        const supabase = createClient();
        const newStock = Math.max(0, item.stock_available + qty);

        await supabase.from('inventory_movements').insert({
            material_id: item.id,
            movement_type_code: qty > 0 ? '101' : '201',
            quantity: Math.abs(qty),
            previous_stock: item.stock_available,
            new_stock: newStock,
            reason,
            notes: notes || null,
            performed_by: 'Admin',
        });

        await supabase.from('global_inventory').update({
            stock_available: newStock,
            updated_at: new Date().toISOString(),
        }).eq('id', item.id);

        setSaving(false);
        onSaved();
        onClose();
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '440px', fontFamily: 'Inter,sans-serif' }}>
                <div style={{ marginBottom: '24px' }}>
                    <p style={{ margin: '0 0 2px 0', fontSize: '11px', color: '#FFD60A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Ajuste Manual de Stock</p>
                    <h3 style={{ margin: 0, fontWeight: 900, fontSize: '18px', color: 'white' }}>{item.name}</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>Stock actual: <strong style={{ color: 'white' }}>{item.stock_available} {item.unit}</strong></p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Quantity */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                            Cantidad (+ entrada / - salida)
                        </label>
                        <input
                            type="number"
                            value={qty}
                            onChange={e => setQty(Number(e.target.value))}
                            style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${qty > 0 ? 'rgba(52,199,89,0.4)' : qty < 0 ? 'rgba(255,59,48,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', color: qty > 0 ? '#34C759' : qty < 0 ? '#FF3B30' : 'white', fontFamily: 'inherit', fontWeight: 800, fontSize: '20px', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {qty !== 0 && (
                            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                                Nuevo stock: <strong style={{ color: qty > 0 ? '#34C759' : '#FF9500' }}>{Math.max(0, item.stock_available + qty)} {item.unit}</strong>
                            </p>
                        )}
                    </div>

                    {/* Reason */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Motivo</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {['compra', 'devolución', 'ajuste', 'venta', 'merma', 'pérdida'].map(r => (
                                <button key={r} onClick={() => setReason(r)} style={{ padding: '7px 14px', borderRadius: '10px', border: `1px solid ${reason === r ? 'rgba(255,214,10,0.5)' : 'rgba(255,255,255,0.1)'}`, background: reason === r ? 'rgba(255,214,10,0.12)' : 'rgba(255,255,255,0.04)', color: reason === r ? '#FFD60A' : 'rgba(255,255,255,0.45)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '12px', textTransform: 'capitalize' }}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Notas (opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej: Orden de compra #001, daño en transporte..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontFamily: 'inherit', fontWeight: 500, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px' }}>
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving || qty === 0} style={{ flex: 2, padding: '14px', borderRadius: '14px', border: 'none', background: qty === 0 ? 'rgba(255,255,255,0.06)' : qty > 0 ? 'linear-gradient(135deg,#34C759,#30D158)' : 'linear-gradient(135deg,#FF3B30,#FF6B6B)', color: qty === 0 ? 'rgba(255,255,255,0.3)' : 'white', cursor: qty === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '14px' }}>
                        {saving ? 'Guardando…' : qty > 0 ? `➕ Ingresar ${qty} ${item.unit}` : qty < 0 ? `➖ Retirar ${Math.abs(qty)} ${item.unit}` : 'Ajustar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function InventarioPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [cat, setCat] = useState('Todos');
    const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'low'>('all');
    const [adjustItem, setAdjustItem] = useState<Product | null>(null);
    const [shareLoading, setShareLoading] = useState(false);

    const fetchProducts = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from('global_inventory')
            .select('*')
            .eq('is_active', true)
            .order('name');
        setProducts((data as Product[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchProducts();
        // Real-time subscription
        const supabase = createClient();
        const channel = supabase
            .channel('inventory_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'global_inventory' }, fetchProducts)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchProducts]);

    // Filtered list
    const filtered = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.sap_code ?? '').toLowerCase().includes(search.toLowerCase());
        const matchCat = cat === 'Todos' || p.category_name === cat;
        const st = stockStatus(p);
        const matchStatus = statusFilter === 'all' || st === statusFilter;
        return matchSearch && matchCat && matchStatus;
    });

    // Stats
    const totalValue = products.reduce((a, p) => a + p.stock_available * p.average_weighted_cost, 0);
    const criticalCount = products.filter(p => stockStatus(p) === 'critical').length;
    const lowCount = products.filter(p => stockStatus(p) === 'low').length;
    const totalSKU = products.length;
    const quarantineTotal = products.reduce((a, p) => a + (p.stock_quarantine || 0), 0);

    // WhatsApp share
    function shareOnWhatsApp() {
        setShareLoading(true);
        const alertItems = products.filter(p => stockStatus(p) !== 'ok');
        const text = `📦 *INVENTARIO CASA INTELIGENTE*\n${new Date().toLocaleDateString('es-VE')}\n\n` +
            `💰 Valor total: ${usd(totalValue)}\n🔴 Sin stock: ${criticalCount}\n🟡 Stock bajo: ${lowCount}\n\n` +
            (alertItems.length > 0 ? `*⚠️ REQUIEREN ATENCIÓN:*\n${alertItems.map(p => `• ${p.name}: ${p.stock_available} ${p.unit} (mín ${p.reorder_point})`).join('\n')}` : '✅ Todo el inventario en niveles normales.');
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        setShareLoading(false);
    }

    const glass = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', backdropFilter: 'blur(20px)' };

    return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', padding: '20px', paddingBottom: '100px' }}>
            <style>{`
                * { box-sizing: border-box; }
                input::placeholder { color: rgba(255,255,255,0.25); }
                ::-webkit-scrollbar { width: 4px; height: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
                @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
                @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
                .fade-in { animation: fadeIn 0.3s ease; }
            `}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: 700, color: '#FFD60A', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        📦 CASA INTELIGENTE
                    </p>
                    <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 900, letterSpacing: '-1px' }}>Inventario</h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                        {totalSKU} SKUs · {loading ? '…' : `${criticalCount + lowCount} alertas activas`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <Link href="/almacen/kardex">
                        <button style={{ padding: '12px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '13px' }}>
                            📋 Kardex
                        </button>
                    </Link>
                    <button onClick={shareOnWhatsApp} disabled={shareLoading} style={{ padding: '12px 18px', borderRadius: '14px', border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.08)', color: '#25D366', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '13px' }}>
                        💬 Reporte WA
                    </button>
                    <Link href="/almacen/nuevo">
                        <button style={{ padding: '12px 22px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg,#FFD60A,#FF9500)', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900, fontSize: '13px' }}>
                            + Nuevo Item
                        </button>
                    </Link>
                </div>
            </div>

            {/* ── Alert banner ── */}
            {(criticalCount > 0 || lowCount > 0) && !loading && (
                <div className="fade-in" style={{ padding: '14px 20px', borderRadius: '16px', background: criticalCount > 0 ? 'rgba(255,59,48,0.1)' : 'rgba(255,149,0,0.08)', border: `1px solid ${criticalCount > 0 ? 'rgba(255,59,48,0.3)' : 'rgba(255,149,0,0.25)'}`, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '22px' }}>{criticalCount > 0 ? '🚨' : '⚠️'}</span>
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '13px', color: criticalCount > 0 ? '#FF3B30' : '#FF9500' }}>
                            {criticalCount > 0 ? `${criticalCount} producto(s) SIN STOCK` : ''}{criticalCount > 0 && lowCount > 0 ? ' · ' : ''}{lowCount > 0 ? `${lowCount} producto(s) con STOCK BAJO` : ''}
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Filtra por estado para ver los ítems afectados</p>
                    </div>
                    <button onClick={() => setStatusFilter(criticalCount > 0 ? 'critical' : 'low')} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }}>
                        Ver alertas →
                    </button>
                </div>
            )}

            {/* ── Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px', marginBottom: '24px' }}>
                <StatCard label="Valor Total" value={loading ? '…' : usd(totalValue)} color="#FFD60A" emoji="💰" sub="Costo ponderado" />
                <StatCard label="Sin Stock" value={criticalCount} color="#FF3B30" emoji="🔴" sub={criticalCount > 0 ? 'Requiere acción urgente' : 'Todo operativo'} />
                <StatCard label="Stock Bajo" value={lowCount} color="#FF9500" emoji="🟡" sub={`Bajo punto de reorden`} />
                <StatCard label="En Cuarentena" value={`${quarantineTotal}`} color="#00AEEF" emoji="🔵" sub="Unidades retenidas" />
                <StatCard label="Total SKUs" value={totalSKU} color="rgba(255,255,255,0.8)" emoji="📦" sub="Productos activos" />
            </div>

            {/* ── Filters ── */}
            <div style={{ ...glass, padding: '16px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar producto o código…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '11px 14px 11px 38px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontFamily: 'inherit', fontSize: '13px', outline: 'none' }}
                    />
                </div>

                {/* Status filter pills */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                        { key: 'all', label: 'Todos', color: 'rgba(255,255,255,0.6)' },
                        { key: 'critical', label: '🔴 Sin Stock', color: '#FF3B30' },
                        { key: 'low', label: '🟡 Bajo', color: '#FF9500' },
                    ].map(f => (
                        <button key={f.key} onClick={() => setStatusFilter(f.key as any)} style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${statusFilter === f.key ? f.color + '60' : 'rgba(255,255,255,0.08)'}`, background: statusFilter === f.key ? f.color + '15' : 'transparent', color: statusFilter === f.key ? f.color : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Category tabs ── */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
                {CATS.map(c => (
                    <button key={c} onClick={() => setCat(c)} style={{ padding: '8px 16px', borderRadius: '10px', border: `1px solid ${cat === c ? 'rgba(255,214,10,0.4)' : 'rgba(255,255,255,0.07)'}`, background: cat === c ? 'rgba(255,214,10,0.1)' : 'rgba(255,255,255,0.03)', color: cat === c ? '#FFD60A' : 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {c}
                    </button>
                ))}
            </div>

            {/* ── Product Grid ── */}
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '12px' }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} style={{ ...glass, padding: '20px', height: '140px', animation: 'pulse 1.5s ease infinite' }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
                    <p style={{ fontWeight: 800, fontSize: '18px', margin: '0 0 8px 0' }}>No hay productos</p>
                    <p style={{ fontWeight: 500, fontSize: '13px', margin: 0 }}>Ajusta los filtros o agrega un nuevo ítem</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '12px' }}>
                    {filtered.map(item => {
                        const st = stockStatus(item);
                        const sts = STATUS[st];
                        const stockPct = item.reorder_point > 0 ? Math.min(100, Math.round((item.stock_available / (item.reorder_point * 3)) * 100)) : 100;

                        return (
                            <div key={item.id} className="fade-in" style={{ ...glass, padding: '20px', position: 'relative', transition: 'border-color 0.2s', cursor: 'default' }}>
                                {/* Status pill */}
                                <div style={{ position: 'absolute', top: '16px', right: '16px', padding: '4px 10px', borderRadius: '8px', background: sts.bg, border: `1px solid ${sts.border}`, fontSize: '10px', fontWeight: 800, color: sts.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {sts.label}
                                </div>

                                {/* Product info */}
                                <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0, overflow: 'hidden' }}>
                                        {item.image_url ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📦'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {item.sap_code && (
                                            <p style={{ margin: '0 0 3px 0', fontSize: '10px', fontWeight: 700, color: '#00AEEF', letterSpacing: '0.5px' }}>{item.sap_code}</p>
                                        )}
                                        <h4 style={{ margin: '0 0 2px 0', fontWeight: 800, fontSize: '14px', lineHeight: 1.3, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '70px' }}>{item.name}</h4>
                                        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                                            {item.category_name} {item.location && `· ${item.location}`}
                                        </p>
                                    </div>
                                </div>

                                {/* Stock bar */}
                                <div style={{ marginBottom: '14px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Stock disponible</span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Min: {item.reorder_point} {item.unit}</span>
                                    </div>
                                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${stockPct}%`, height: '100%', background: st === 'critical' ? '#FF3B30' : st === 'low' ? '#FF9500' : '#34C759', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                        <span style={{ fontSize: '20px', fontWeight: 900, color: sts.color }}>
                                            {item.stock_available} <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{item.unit}</span>
                                        </span>
                                        {item.stock_quarantine > 0 && (
                                            <span style={{ fontSize: '11px', color: '#00AEEF', fontWeight: 700 }}>+{item.stock_quarantine} cuarentena</span>
                                        )}
                                    </div>
                                </div>

                                {/* Cost & supplier */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div>
                                        <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Costo prom.</p>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>{usd(item.average_weighted_cost)}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => setAdjustItem(item)}
                                            style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255,214,10,0.3)', background: 'rgba(255,214,10,0.08)', color: '#FFD60A', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '12px' }}>
                                            ± Ajustar
                                        </button>
                                        <Link href={`/almacen/kardex?item=${item.id}`}>
                                            <button style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '12px' }}>
                                                📋
                                            </button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Adjust Modal ── */}
            {adjustItem && (
                <AdjustModal
                    item={adjustItem}
                    onClose={() => setAdjustItem(null)}
                    onSaved={fetchProducts}
                />
            )}
        </div>
    );
}
