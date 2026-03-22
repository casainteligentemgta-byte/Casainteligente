'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────
interface ScannedItem {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    material_id: string | null;   // linked after scan
}

interface ScannedInvoice {
    invoice_number: string;
    supplier_name: string;
    supplier_rif: string;
    date: string;
    currency: string;
    subtotal: number;
    iva: number;
    total: number;
    items: ScannedItem[];
    notes: string;
}

interface Material {
    id: string;
    name: string;
    sap_code: string | null;
    unit: string;
    stock_available: number;
    average_weighted_cost: number;
}

// ── Helpers ────────────────────────────────────────────────────
const usd = (v: number) => `$${Number(v || 0).toFixed(2)}`;

// Try to auto-match a scanned description to existing inventory
function autoMatch(description: string, materials: Material[]): string | null {
    const d = description.toLowerCase();
    const match = materials.find(m =>
        m.name.toLowerCase().includes(d.substring(0, 6)) ||
        d.includes(m.name.toLowerCase().substring(0, 6)) ||
        (m.sap_code && d.includes(m.sap_code.toLowerCase()))
    );
    return match?.id ?? null;
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function ProcurementPage() {
    const router = useRouter();
    const scanInputRef = useRef<HTMLInputElement>(null);

    const [mode, setMode] = useState<'selector' | 'scanning' | 'review' | 'manual'>('selector');
    const [scanProgress, setScanProgress] = useState('');
    const [scanError, setScanError] = useState('');
    const [materials, setMaterials] = useState<Material[]>([]);
    const [saving, setSaving] = useState(false);
    const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
    const pendingFileRef = useRef<File | null>(null);

    // Form state
    const [invoice, setInvoice] = useState<ScannedInvoice>({
        invoice_number: '', supplier_name: '', supplier_rif: '',
        date: new Date().toISOString().split('T')[0],
        currency: 'USD', subtotal: 0, iva: 0, total: 0, items: [], notes: ''
    });
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        createClient().from('global_inventory').select('id,name,sap_code,unit,stock_available,average_weighted_cost').then(({ data }) => {
            setMaterials((data as Material[]) ?? []);
        });
    }, []);

    // ── AI Scan ──────────────────────────────────────────────
    async function handleScan(file: File) {
        if (!file) return;
        setPreviewUrl(URL.createObjectURL(file));
        setMode('scanning');
        setScanProgress('📤 Subiendo imagen…');
        setScanError('');
        setRateLimitCountdown(0);

        const fd = new FormData();
        fd.append('file', file);

        try {
            setScanProgress('🤖 Gemini analizando la factura…');
            const res = await fetch('/api/scan-invoice', { method: 'POST', body: fd });
            const json = await res.json();

            // Handle rate limit — show countdown and auto-retry
            if (res.status === 429) {
                pendingFileRef.current = file;
                setMode('selector');
                let secs = 62;
                setRateLimitCountdown(secs);
                const timer = setInterval(() => {
                    secs--;
                    setRateLimitCountdown(secs);
                    if (secs <= 0) {
                        clearInterval(timer);
                        setRateLimitCountdown(0);
                        if (pendingFileRef.current) handleScan(pendingFileRef.current);
                    }
                }, 1000);
                return;
            }

            if (!res.ok || !json.success) {
                setScanError(json.error ?? 'Error desconocido del servidor.');
                setMode('selector');
                return;
            }

            setScanProgress('✅ Factura escaneada — revisando datos…');

            // Auto-match items to inventory
            const enrichedItems: ScannedItem[] = (json.data.items ?? []).map((item: ScannedItem) => ({
                ...item,
                material_id: autoMatch(item.description, materials),
            }));

            setInvoice({ ...json.data, items: enrichedItems });
            setMode('review');

        } catch (e: any) {
            setScanError('Error de red: ' + e.message);
            setMode('selector');
        }
    }

    // ── Item helpers ─────────────────────────────────────────
    function updateItem(i: number, field: keyof ScannedItem, value: any) {
        setInvoice(prev => {
            const items = [...prev.items];
            (items[i] as any)[field] = value;
            if (field === 'quantity' || field === 'unit_price') {
                items[i].total_price = items[i].quantity * items[i].unit_price;
            }
            return { ...prev, items };
        });
    }

    function addItem() {
        setInvoice(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unit: 'UND', unit_price: 0, total_price: 0, material_id: null }] }));
    }

    function removeItem(i: number) {
        setInvoice(prev => ({ ...prev, items: prev.items.filter((_, j) => j !== i) }));
    }

    const calcTotal = () => invoice.items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

    // ── Save ─────────────────────────────────────────────────
    async function handleSave() {
        if (!invoice.supplier_name) { alert('Nombre del proveedor requerido.'); return; }
        if (invoice.items.length === 0) { alert('Agrega al menos un ítem.'); return; }
        setSaving(true);

        const supabase = createClient();
        const total = calcTotal();

        try {
            // 1. Create invoice header
            const { data: inv, error: invErr } = await supabase
                .from('purchase_invoices')
                .insert({ invoice_number: invoice.invoice_number, supplier_rif: invoice.supplier_rif, supplier_name: invoice.supplier_name, date: invoice.date, total_amount: total, status: 'APROBADA' })
                .select().single();
            if (invErr) throw invErr;

            // 2. Process each item
            for (const item of invoice.items) {
                if (!item.material_id) continue; // skip unmapped

                // Insert purchase detail
                const { data: det, error: detErr } = await supabase
                    .from('purchase_details')
                    .insert({ invoice_id: inv.id, material_id: item.material_id, quantity: item.quantity, unit_price: item.unit_price, total_price: item.quantity * item.unit_price })
                    .select().single();
                if (detErr) throw detErr;

                // Get current stock
                const { data: mat } = await supabase.from('global_inventory').select('stock_available,average_weighted_cost').eq('id', item.material_id).single();
                const currentStock = mat?.stock_available ?? 0;
                const currentCost = mat?.average_weighted_cost ?? 0;
                const newStock = currentStock + item.quantity;
                // Weighted average cost
                const newCost = currentStock === 0 ? item.unit_price : ((currentStock * currentCost) + (item.quantity * item.unit_price)) / newStock;

                // Update stock with weighted average
                await supabase.from('global_inventory').update({
                    stock_available: newStock,
                    average_weighted_cost: parseFloat(newCost.toFixed(4)),
                    last_purchase_price: item.unit_price,
                    last_purchase_date: invoice.date,
                    updated_at: new Date().toISOString(),
                }).eq('id', item.material_id);

                // Register Kardex movement
                await supabase.from('inventory_movements').insert({
                    material_id: item.material_id,
                    movement_type_code: '101',
                    quantity: item.quantity,
                    previous_stock: currentStock,
                    new_stock: newStock,
                    reason: 'compra',
                    notes: `Factura ${invoice.invoice_number} — ${invoice.supplier_name}`,
                    performed_by: 'Procurement IA',
                });

                // Quality inspection
                await supabase.from('quality_inspections').insert({
                    invoice_id: inv.id,
                    material_id: item.material_id,
                    quantity: item.quantity,
                    purchase_detail_id: det.id,
                    status: 'APROBADO',
                });
            }

            router.push('/almacen');
        } catch (e: any) {
            alert('Error al guardar: ' + e.message);
        } finally {
            setSaving(false);
        }
    }

    // ── Shared styles ─────────────────────────────────────────
    const glass = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', backdropFilter: 'blur(20px)' };
    const inputS: React.CSSProperties = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontFamily: 'Inter,sans-serif', fontSize: '13px', fontWeight: 500, outline: 'none', boxSizing: 'border-box' };
    const labelS: React.CSSProperties = { display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' };

    return (
        <div style={{ minHeight: '100vh', background: '#0A0A0F', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', padding: '20px', paddingBottom: '80px' }}>
            <style>{`* { box-sizing:border-box; } input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.2); } select option { background:#111; } @keyframes spin { to { transform:rotate(360deg); } } .spin { animation: spin 1s linear infinite; } @keyframes fadeIn { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} } .fi { animation: fadeIn 0.3s ease; }`}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
                <Link href="/almacen">
                    <button style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '13px' }}>← Inventario</button>
                </Link>
                <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '10px', fontWeight: 700, color: '#FFD60A', letterSpacing: '2px', textTransform: 'uppercase' }}>PROCUREMENT</p>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, letterSpacing: '-0.5px' }}>Registrar Compra</h1>
                </div>
            </div>

            {/* ══════════ SELECTOR ══════════ */}
            {mode === 'selector' && (
                <div className="fi">
                    {scanError && (
                        <div style={{ padding: '14px 18px', borderRadius: '14px', background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', color: '#FF3B30', fontWeight: 700, fontSize: '13px', marginBottom: '20px' }}>
                            ⚠️ {scanError}
                        </div>
                    )}

                    {/* Rate limit countdown */}
                    {rateLimitCountdown > 0 && (
                        <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.3)', marginBottom: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '40px', fontWeight: 900, color: '#FF9500', lineHeight: 1 }}>{rateLimitCountdown}s</div>
                            <p style={{ margin: '8px 0 4px 0', fontSize: '13px', fontWeight: 800, color: '#FF9500' }}>⏱ Límite de Gemini alcanzado</p>
                            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Reintentando automáticamente en {rateLimitCountdown} segundos…</p>
                            <div style={{ marginTop: '12px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', background: '#FF9500', borderRadius: '2px', width: `${(rateLimitCountdown / 62) * 100}%`, transition: 'width 1s linear' }} />
                            </div>
                        </div>
                    )}

                {/* ── Botón principal IA ── */}
                    <button
                        onClick={() => scanInputRef.current?.click()}
                        style={{ ...glass, width: '100%', padding: '36px 20px', cursor: 'pointer', textAlign: 'center', border: '1px solid rgba(123,97,255,0.35)', background: 'linear-gradient(135deg,rgba(123,97,255,0.08),rgba(0,174,239,0.06))', transition: 'all 0.2s', marginBottom: '10px' }}
                    >
                        <div style={{ fontSize: '48px', marginBottom: '14px' }}>🤖</div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 900, background: 'linear-gradient(135deg,#7B61FF,#00AEEF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Escanear Factura con IA</p>
                        <p style={{ margin: '0 0 18px 0', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Gemini 1.5 Flash · Extrae datos automáticamente</p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            {['📷 Cámara', '🖼 Galería', '📄 PDF'].map(op => (
                                <span key={op} style={{ padding: '5px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>{op}</span>
                            ))}
                        </div>
                    </button>

                    {/* Manual */}
                    <button onClick={() => { setMode('manual'); setInvoice(prev => ({ ...prev, items: [{ description: '', quantity: 1, unit: 'UND', unit_price: 0, total_price: 0, material_id: null }] })); }} style={{ ...glass, width: '100%', padding: '18px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                        <span style={{ fontSize: '20px', marginRight: '10px' }}>📝</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>Ingreso Manual</span>
                    </button>

                    <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(0,174,239,0.05)', border: '1px solid rgba(0,174,239,0.15)', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px' }}>✨</span>
                        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, lineHeight: 1.5 }}>
                            <strong style={{ color: '#00AEEF' }}>Modo IA:</strong> Gemini 1.5 Flash extrae número de factura, proveedor, RIF, ítems, cantidades y precios. Solo revisa y confirma.
                        </p>
                    </div>

                    {/* Input unificado — sin capture para mostrar cámara Y archivos en móvil */}
                    <input ref={scanInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f); e.target.value = ''; }}
                    />
                </div>
            )}

            {/* ══════════ SCANNING ══════════ */}
            {mode === 'scanning' && (
                <div className="fi" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '24px' }}>
                    {previewUrl && (
                        <div style={{ width: '200px', height: '200px', borderRadius: '20px', overflow: 'hidden', border: '2px solid rgba(123,97,255,0.4)', position: 'relative' }}>
                            <img src={previewUrl} alt="factura" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(2px) brightness(0.7)' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '40px', height: '40px', border: '3px solid transparent', borderTopColor: '#7B61FF', borderRadius: '50%' }} className="spin" />
                            </div>
                        </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 900, color: 'white' }}>Procesando con Gemini IA</p>
                        <p style={{ margin: 0, fontSize: '14px', color: '#7B61FF', fontWeight: 700 }}>{scanProgress}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {['Cargando', 'Analizando', 'Extrayendo', 'Mapeando'].map((s, i) => (
                            <div key={s} style={{ padding: '6px 12px', borderRadius: '20px', background: i === 0 ? 'rgba(123,97,255,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${i === 0 ? 'rgba(123,97,255,0.4)' : 'rgba(255,255,255,0.07)'}`, fontSize: '11px', fontWeight: 700, color: i === 0 ? '#7B61FF' : 'rgba(255,255,255,0.3)' }}>{s}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════ REVIEW / MANUAL ══════════ */}
            {(mode === 'review' || mode === 'manual') && (
                <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* AI success banner */}
                    {mode === 'review' && (
                        <div style={{ padding: '14px 18px', borderRadius: '14px', background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.25)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '22px' }}>✅</span>
                            <div>
                                <p style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 800, color: '#34C759' }}>Factura escaneada con Gemini IA</p>
                                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Revisa los datos y ajusta lo necesario antes de confirmar</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                                {previewUrl && (
                                    <img src={previewUrl} alt="" style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Encabezado de factura ── */}
                    <div style={{ ...glass, padding: '22px' }}>
                        <p style={{ margin: '0 0 18px 0', fontSize: '11px', fontWeight: 700, color: '#FFD60A', textTransform: 'uppercase', letterSpacing: '1px' }}>📄 Datos de la Factura</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>
                            <div>
                                <label style={labelS}>Nº Factura</label>
                                <input style={inputS} value={invoice.invoice_number} onChange={e => setInvoice(p => ({ ...p, invoice_number: e.target.value }))} placeholder="001-2034" />
                            </div>
                            <div>
                                <label style={labelS}>Proveedor *</label>
                                <input style={inputS} value={invoice.supplier_name} onChange={e => setInvoice(p => ({ ...p, supplier_name: e.target.value }))} placeholder="Nombre comercial" />
                            </div>
                            <div>
                                <label style={labelS}>RIF Proveedor</label>
                                <input style={inputS} value={invoice.supplier_rif} onChange={e => setInvoice(p => ({ ...p, supplier_rif: e.target.value }))} placeholder="J-12345678-0" />
                            </div>
                            <div>
                                <label style={labelS}>Fecha</label>
                                <input type="date" style={inputS} value={invoice.date} onChange={e => setInvoice(p => ({ ...p, date: e.target.value }))} />
                            </div>
                            <div>
                                <label style={labelS}>Moneda</label>
                                <select style={inputS} value={invoice.currency} onChange={e => setInvoice(p => ({ ...p, currency: e.target.value }))}>
                                    {['USD', 'VES', 'EUR'].map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        {invoice.notes && (
                            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(255,214,10,0.06)', border: '1px solid rgba(255,214,10,0.2)', borderRadius: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                                📝 {invoice.notes}
                            </div>
                        )}
                    </div>

                    {/* ── Ítems ── */}
                    <div style={{ ...glass, padding: '22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#34C759', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                📦 Ítems ({invoice.items.length})
                            </p>
                            <button onClick={addItem} style={{ padding: '7px 14px', borderRadius: '10px', border: '1px solid rgba(52,199,89,0.3)', background: 'rgba(52,199,89,0.08)', color: '#34C759', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '12px' }}>
                                + Agregar
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {invoice.items.map((item, i) => {
                                const linked = materials.find(m => m.id === item.material_id);
                                return (
                                    <div key={i} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${item.material_id ? 'rgba(52,199,89,0.2)' : 'rgba(255,149,0,0.2)'}`, borderRadius: '14px' }}>
                                        {/* Match indicator */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: item.material_id ? '#34C759' : '#FF9500' }}>
                                                    {item.material_id ? `✅ Mapeado: ${linked?.name}` : '⚠️ Sin mapear — elige producto'}
                                                </span>
                                            </div>
                                            <button onClick={() => removeItem(i)} style={{ padding: '4px 10px', borderRadius: '8px', border: 'none', background: 'rgba(255,59,48,0.1)', color: '#FF3B30', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '11px' }}>✕</button>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                                            {/* Product selector */}
                                            <div>
                                                <label style={labelS}>Producto del inventario</label>
                                                <select
                                                    value={item.material_id ?? ''}
                                                    onChange={e => {
                                                        updateItem(i, 'material_id', e.target.value || null);
                                                        const m = materials.find(m => m.id === e.target.value);
                                                        if (m) updateItem(i, 'description', m.name);
                                                    }}
                                                    style={{ ...inputS, color: item.material_id ? 'white' : 'rgba(255,149,0,0.9)' }}
                                                >
                                                    <option value="">— Sin mapear —</option>
                                                    {materials.map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}{m.sap_code ? ` [${m.sap_code}]` : ''}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {/* Qty */}
                                            <div>
                                                <label style={labelS}>Cantidad</label>
                                                <input type="number" min="0" step="0.01" style={inputS} value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} />
                                            </div>
                                            {/* Unit price */}
                                            <div>
                                                <label style={labelS}>P. Unit ({invoice.currency})</label>
                                                <input type="number" min="0" step="0.01" style={inputS} value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                                            </div>
                                            {/* Total */}
                                            <div>
                                                <label style={labelS}>Total</label>
                                                <div style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '13px', fontWeight: 800, color: '#FFD60A' }}>
                                                    {usd(item.quantity * item.unit_price)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Gemini description (reference) */}
                                        {mode === 'review' && item.description && (
                                            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
                                                🤖 IA detectó: <em>"{item.description}"</em>
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Totales ── */}
                    <div style={{ ...glass, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
                            <div>
                                <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase' }}>Subtotal</p>
                                <p style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>{usd(calcTotal())}</p>
                            </div>
                            <div>
                                <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase' }}>IVA (16%)</p>
                                <p style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>{usd(calcTotal() * 0.16)}</p>
                            </div>
                            <div>
                                <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#FFD60A', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL</p>
                                <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#FFD60A' }}>{usd(calcTotal() * 1.16)}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => { setMode('selector'); setPreviewUrl(null); setScanError(''); }} style={{ padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '13px' }}>
                                ← Volver
                            </button>
                            <button onClick={handleSave} disabled={saving} style={{ padding: '14px 28px', borderRadius: '14px', border: 'none', background: saving ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#34C759,#30D158)', color: saving ? 'rgba(255,255,255,0.3)' : 'white', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 900, fontSize: '14px', boxShadow: saving ? 'none' : '0 4px 20px rgba(52,199,89,0.3)' }}>
                                {saving ? '⏳ Guardando…' : '✅ Confirmar Compra'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
