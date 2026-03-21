'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import ProductSearch, { Product } from '@/components/ventas/ProductSearch';

interface LineItem {
    id: string;
    product: Product;
    qty: number;
    unitPrice: number;
    discount: number;
}

/** Fila mínima de `customers` para el selector de presupuesto */
interface CustomerPickerRow {
    id: string;
    nombre: string | null;
    rif: string | null;
    movil: string | null;
    email: string | null;
    direccion: string | null;
}

const MARGIN_PRESETS = [0, 10, 15, 20, 25, 30];

function formatUSD(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CategoryBadge({ cat }: { cat: string | null }) {
    const colorMap: Record<string, { bg: string; text: string }> = {
        'Cámaras IP': { bg: 'rgba(0,122,255,0.15)', text: '#007AFF' },
        'Cámaras Análogas': { bg: 'rgba(88,86,214,0.15)', text: '#5856D6' },
        'C.C.T.V': { bg: 'rgba(88,86,214,0.15)', text: '#5856D6' },
        'Servicio': { bg: 'rgba(52,199,89,0.15)', text: '#34C759' },
        'Cercos Eléctricos': { bg: 'rgba(255,149,0,0.15)', text: '#FF9500' },
        'Internet': { bg: 'rgba(0,199,190,0.15)', text: '#00C7BE' },
        'Domótica': { bg: 'rgba(255,45,85,0.15)', text: '#FF2D55' },
        'Network': { bg: 'rgba(0,199,190,0.15)', text: '#00C7BE' },
        'Materiales': { bg: 'rgba(142,142,147,0.15)', text: '#8E8E93' },
    };
    const c = colorMap[cat ?? ''] ?? { bg: 'rgba(142,142,147,0.15)', text: '#8E8E93' };
    return (
        <span style={{
            background: c.bg, color: c.text,
            fontSize: '10px', fontWeight: 600, padding: '2px 7px',
            borderRadius: '6px', letterSpacing: '0.3px', whiteSpace: 'nowrap',
        }}>
            {cat ?? 'General'}
        </span>
    );
}

function VentasContent() {
    const searchParams = useSearchParams();
    const [items, setItems] = useState<LineItem[]>([]);
    const [globalMargin, setGlobalMargin] = useState(20);
    const [clientName, setClientName] = useState('');
    const [clientRif, setClientRif] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientDireccion, setClientDireccion] = useState('');
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [customers, setCustomers] = useState<CustomerPickerRow[]>([]);
    const [customersLoading, setCustomersLoading] = useState(true);
    const [customerQuery, setCustomerQuery] = useState('');
    const legacyParamsResolved = useRef(false);
    const [budgetId, setBudgetId] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [showZelle, setShowZelle] = useState(true);
    const [showSummary, setShowSummary] = useState(false);
    const [saving, setSaving] = useState(false);

    const applyCustomer = useCallback((c: CustomerPickerRow) => {
        setCustomerId(c.id);
        setClientName((c.nombre || '').trim() || 'Sin nombre');
        setClientRif((c.rif || '').trim());
        setClientPhone((c.movil || '').trim());
        setClientEmail((c.email || '').trim());
        setClientDireccion((c.direccion || '').trim());
    }, []);

    const clearCustomer = useCallback(() => {
        setCustomerId(null);
        setClientName('');
        setClientRif('');
        setClientPhone('');
        setClientEmail('');
        setClientDireccion('');
        setCustomerQuery('');
    }, []);

    useEffect(() => {
        let cancelled = false;
        const supabase = createClient();
        setCustomersLoading(true);
        supabase
            .from('customers')
            .select('id,nombre,rif,movil,email,direccion')
            .order('nombre', { ascending: true, nullsFirst: false })
            .then(({ data, error }) => {
                if (cancelled) return;
                setCustomersLoading(false);
                if (!error && data) setCustomers(data as CustomerPickerRow[]);
                else setCustomers([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    /** Enlaces antiguos ?cliente=&rif= → fila en `customers` */
    useEffect(() => {
        if (legacyParamsResolved.current) return;
        const budgetId = searchParams.get('id');
        const cId = searchParams.get('customerId');
        if (budgetId || cId) {
            legacyParamsResolved.current = true;
            return;
        }
        if (customers.length === 0) return;

        const nombre = searchParams.get('cliente');
        const rif = searchParams.get('rif');
        if (!nombre?.trim() && !rif?.trim()) {
            legacyParamsResolved.current = true;
            return;
        }

        const norm = (s: string | null) => (s || '').trim().toLowerCase();
        const matched =
            (rif?.trim() && customers.find((c) => norm(c.rif) === norm(rif))) ||
            (nombre?.trim() && customers.find((c) => norm(c.nombre) === norm(nombre))) ||
            null;

        if (matched) applyCustomer(matched);
        legacyParamsResolved.current = true;
    }, [customers, searchParams, applyCustomer]);

    // Pre-cargar datos desde query params
    useEffect(() => {
        const id = searchParams.get('id');
        const cId = searchParams.get('customerId');

        if (id) setBudgetId(id);
        if (cId) setCustomerId(cId);

        const supabase = createClient();

        if (id) {
            supabase
                .from('budgets')
                .select('*')
                .eq('id', id)
                .single()
                .then(({ data, error }) => {
                    if (!error && data) {
                        setClientName(data.customer_name || '');
                        setClientRif(data.customer_rif || '');
                        setCustomerId(data.customer_id);
                        setNotes(data.notes || '');
                        setShowZelle(data.show_zelle !== false); // Default to true if undefined

                        if (data.customer_id) {
                            supabase
                                .from('customers')
                                .select('movil, email, direccion, nombre, rif')
                                .eq('id', data.customer_id)
                                .single()
                                .then(({ data: c }) => {
                                    if (c) {
                                        setClientPhone((c.movil as string) || '');
                                        setClientEmail((c.email as string) || '');
                                        setClientDireccion((c.direccion as string) || '');
                                        if (c.nombre) setClientName(String(c.nombre));
                                        if (c.rif) setClientRif(String(c.rif));
                                    }
                                });
                        } else {
                            setClientPhone('');
                            setClientEmail('');
                            setClientDireccion('');
                        }

                        // Mapear items de la DB al estado local
                        const loadedItems = (data.items as any[]).map(item => ({
                            id: `${item.product_id}-${Math.random()}`,
                            product: item.product_data,
                            qty: item.qty,
                            unitPrice: item.unit_price,
                            discount: item.discount || 0
                        }));
                        setItems(loadedItems);
                    }
                });
        }

        // Si tenemos ID de cliente pero no datos cargados, buscarlos
        if (cId) {
            supabase
                .from('customers')
                .select('id,nombre,rif,movil,email,direccion')
                .eq('id', cId)
                .single()
                .then(({ data }) => {
                    if (data) applyCustomer(data as CustomerPickerRow);
                });
        }

        const prodIds = searchParams.get('productos');
        if (prodIds && !id) { // Solo si no estamos cargando un presupuesto ya guardado
            const idsList = prodIds.split(',').filter(Boolean);
            if (idsList.length > 0) {
                supabase
                    .from('products')
                    .select('*')
                    .in('id', idsList)
                    .then(({ data, error }) => {
                        if (!error && data) {
                            const newItems = data.map((p: Product) => ({
                                id: `${p.id}-${Math.random().toString(36).substr(2, 9)}`,
                                product: p,
                                qty: 1,
                                unitPrice: parseFloat(((p.precio ?? 0) * (1 + globalMargin / 100)).toFixed(2)),
                                discount: 0,
                            }));
                            setItems(prev => {
                                const existingIds = prev.map(i => i.product.id);
                                const filteredNew = newItems.filter(i => !existingIds.includes(i.product.id));
                                return [...prev, ...filteredNew];
                            });
                        }
                    });
            }
        }
    }, [searchParams, globalMargin, applyCustomer]);

    const filteredCustomers = useMemo(() => {
        const q = customerQuery.trim().toLowerCase();
        if (!q) return customers;
        return customers.filter(
            (c) =>
                (c.nombre || '').toLowerCase().includes(q) ||
                (c.rif || '').toLowerCase().includes(q) ||
                (c.movil || '').includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.direccion || '').toLowerCase().includes(q),
        );
    }, [customers, customerQuery]);

    const handleSaveBudget = async () => {
        if (!customerId) return alert('Selecciona un cliente de la lista (Clientes).');
        if (items.length === 0) return alert('El presupuesto está vacío');

        setSaving(true);
        const supabase = createClient();

        const budgetData = {
            customer_name: clientName,
            customer_rif: clientRif,
            customer_id: customerId || null,
            items: items.map(i => ({
                product_id: i.product.id,
                product_data: i.product,
                qty: i.qty,
                unit_price: i.unitPrice,
                discount: i.discount
            })),
            subtotal: subtotal,
            total_cost: totalCost,
            total_profit: totalProfit,
            margin_pct: marginPct,
            notes: notes,
            show_zelle: showZelle,
            status: 'pendiente'
        };

        let res;
        if (budgetId) {
            res = await supabase
                .from('budgets')
                .update(budgetData)
                .eq('id', budgetId);
        } else {
            res = await supabase
                .from('budgets')
                .insert([budgetData])
                .select()
                .single();
            if (!res.error && res.data) {
                setBudgetId(res.data.id);
            }
        }

        setSaving(false);
        if (res.error) {
            alert('Error al guardar presupuesto: ' + res.error.message);
        } else {
            alert('✅ Presupuesto guardado correctamente');
        }
    };

    const addProduct = (product: Product) => {
        const existing = items.find(i => i.product.id === product.id);
        if (existing) {
            setItems(prev => prev.map(i =>
                i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
            ));
            return;
        }
        const basePrice = product.precio ?? 0;
        const withMargin = basePrice * (1 + globalMargin / 100);
        setItems(prev => [...prev, {
            id: `${product.id}-${Date.now()}`,
            product,
            qty: 1,
            unitPrice: parseFloat(withMargin.toFixed(2)),
            discount: 0,
        }]);
    };

    const updateQty = (id: string, qty: number) => {
        if (qty < 1) return;
        setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
    };

    const updatePrice = (id: string, price: number) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, unitPrice: price } : i));
    };

    const updateDiscount = (id: string, disc: number) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, discount: Math.min(100, Math.max(0, disc)) } : i));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const applyGlobalMargin = (margin: number) => {
        setGlobalMargin(margin);
        setItems(prev => prev.map(i => ({
            ...i,
            unitPrice: parseFloat(((i.product.precio ?? 0) * (1 + margin / 100)).toFixed(2)),
        })));
    };

    const lineTotal = (item: LineItem) => {
        const after = item.unitPrice * (1 - item.discount / 100);
        return after * item.qty;
    };

    const lineCost = (item: LineItem) => (item.product.costo ?? 0) * item.qty;

    const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
    const totalCost = items.reduce((s, i) => s + lineCost(i), 0);
    const totalProfit = subtotal - totalCost;
    const marginPct = subtotal > 0 ? (totalProfit / subtotal) * 100 : 0;

    const glass = {
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
    } as React.CSSProperties;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>

            {/* ── Header ── */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '16px 20px 12px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'rgba(52,199,89,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="#34C759" strokeWidth="2" strokeLinecap="round" />
                                <rect x="9" y="3" width="6" height="4" rx="1" stroke="#34C759" strokeWidth="2" />
                                <path d="M9 12h6M9 16h4" stroke="#34C759" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div>
                            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', lineHeight: 1 }}>Presupuesto</h1>
                            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>
                                {items.length} producto{items.length !== 1 ? 's' : ''} · ${formatUSD(subtotal)}
                            </p>
                        </div>
                    </div>
                    {items.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleSaveBudget}
                                disabled={saving}
                                style={{
                                    background: 'rgba(52,199,89,0.15)',
                                    border: '1px solid rgba(52,199,89,0.3)',
                                    borderRadius: '12px',
                                    padding: '8px 14px',
                                    color: '#34C759',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    opacity: saving ? 0.7 : 1,
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points="17 21 17 13 7 13 7 21" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {saving ? '...' : 'Guardar'}
                            </button>
                            <button
                                onClick={() => setShowSummary(!showSummary)}
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '12px',
                                    padding: '8px 14px',
                                    color: 'white',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {showSummary ? 'Cerrar' : 'Resumen'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>

                {/* ── Cliente (solo desde tabla `customers`) ── */}
                <div style={{ ...glass, padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--label-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            Cliente
                        </label>
                        <Link
                            href="/clientes"
                            style={{ fontSize: '11px', fontWeight: 600, color: '#007AFF', textDecoration: 'none' }}
                        >
                            Gestionar clientes →
                        </Link>
                    </div>

                    {customerId ? (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                            gap: '12px',
                            background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)',
                            borderRadius: '12px', padding: '12px 14px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    background: 'rgba(52,199,89,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#34C759" strokeWidth="2" strokeLinecap="round" />
                                        <circle cx="12" cy="7" r="4" stroke="#34C759" strokeWidth="2" />
                                    </svg>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ color: '#34C759', fontSize: '14px', fontWeight: 700 }}>{clientName}</p>
                                    {clientRif ? (
                                        <p style={{ color: 'rgba(52,199,89,0.75)', fontSize: '11px', marginTop: '4px' }}>RIF {clientRif}</p>
                                    ) : null}
                                    {clientPhone ? (
                                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', marginTop: '2px' }}>{clientPhone}</p>
                                    ) : null}
                                    {clientEmail ? (
                                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', marginTop: '2px', wordBreak: 'break-all' }}>{clientEmail}</p>
                                    ) : null}
                                    {clientDireccion ? (
                                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '4px', lineHeight: 1.35 }}>{clientDireccion}</p>
                                    ) : null}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={clearCustomer}
                                style={{
                                    background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)',
                                    borderRadius: '8px', padding: '6px 10px',
                                    color: '#FF3B30', fontSize: '11px', fontWeight: 600,
                                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                                }}
                            >
                                Cambiar
                            </button>
                        </div>
                    ) : (
                        <>
                            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
                                Elige un cliente registrado. Los datos (RIF, teléfono, correo, dirección) se usarán en la vista previa y al guardar.
                            </p>
                            <input
                                type="search"
                                value={customerQuery}
                                onChange={(e) => setCustomerQuery(e.target.value)}
                                placeholder="Buscar por nombre, RIF, teléfono o correo…"
                                disabled={customersLoading}
                                style={{
                                    width: '100%',
                                    marginBottom: '10px',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'var(--label-primary)',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                }}
                            />
                            {customersLoading ? (
                                <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>Cargando clientes…</p>
                            ) : customers.length === 0 ? (
                                <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
                                    No hay clientes.{' '}
                                    <Link href="/clientes" style={{ color: '#34C759', fontWeight: 600 }}>Crear uno en Clientes</Link>
                                </p>
                            ) : (
                                <div style={{
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                }}>
                                    {filteredCustomers.length === 0 ? (
                                        <p style={{ padding: '14px', fontSize: '13px', color: 'var(--label-secondary)' }}>Sin coincidencias.</p>
                                    ) : (
                                        filteredCustomers.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => applyCustomer(c)}
                                                style={{
                                                    display: 'block',
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
                                                    border: 'none',
                                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    fontFamily: 'inherit',
                                                }}
                                            >
                                                <span style={{ display: 'block', color: 'var(--label-primary)', fontSize: '14px', fontWeight: 600 }}>
                                                    {(c.nombre || '').trim() || 'Sin nombre'}
                                                </span>
                                                <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px' }}>
                                                    {[c.rif, c.movil, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Product Search ── */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--label-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                        Agregar Producto
                    </label>
                    <ProductSearch onSelect={addProduct} />
                </div>

                {/* ── Margin Presets ── */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--label-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            Margen Global
                        </label>
                        <span style={{ fontSize: '13px', color: '#34C759', fontWeight: 700 }}>{globalMargin}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {MARGIN_PRESETS.map(m => (
                            <button
                                key={m}
                                onClick={() => applyGlobalMargin(m)}
                                style={{
                                    padding: '7px 14px',
                                    borderRadius: '10px',
                                    border: globalMargin === m ? '1px solid #34C759' : '1px solid rgba(255,255,255,0.12)',
                                    background: globalMargin === m ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.05)',
                                    color: globalMargin === m ? '#34C759' : 'var(--label-secondary)',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {m === 0 ? 'Sin margen' : `+${m}%`}
                            </button>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '4px 10px' }}>
                            <input
                                type="number"
                                min={0}
                                max={200}
                                value={globalMargin}
                                onChange={e => applyGlobalMargin(Number(e.target.value))}
                                style={{ width: '40px', background: 'transparent', border: 'none', outline: 'none', color: '#34C759', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', textAlign: 'center' }}
                            />
                            <span style={{ color: 'var(--label-secondary)', fontSize: '13px' }}>%</span>
                        </div>
                    </div>
                </div>

                {/* ── Line Items ── */}
                {items.length === 0 ? (
                    <div style={{
                        ...glass,
                        padding: '48px 24px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛒</div>
                        <h3 style={{ color: 'var(--label-primary)', fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>
                            Presupuesto vacío
                        </h3>
                        <p style={{ color: 'var(--label-secondary)', fontSize: '14px' }}>
                            Busca y agrega productos usando el buscador de arriba
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        {items.map((item, idx) => {
                            const total = lineTotal(item);
                            const cost = lineCost(item);
                            const profit = total - cost;
                            const profitPct = total > 0 ? (profit / total) * 100 : 0;

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        ...glass,
                                        padding: '16px',
                                        animation: 'slideUp 0.3s ease',
                                    }}
                                >
                                    {/* Top row */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                                        {/* Number */}
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '8px',
                                            background: 'rgba(0,122,255,0.15)', border: '1px solid rgba(0,122,255,0.25)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, fontSize: '12px', fontWeight: 700, color: '#007AFF',
                                        }}>
                                            {idx + 1}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                                <CategoryBadge cat={item.product.categoria} />
                                                {item.product.marca && (
                                                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{item.product.marca}</span>
                                                )}
                                            </div>
                                            <p style={{ color: 'var(--label-primary)', fontSize: '14px', fontWeight: 600, lineHeight: 1.3 }}>
                                                {item.product.nombre}
                                            </p>
                                            {item.product.modelo && (
                                                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '2px' }}>
                                                    Modelo: {item.product.modelo}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            style={{
                                                background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)',
                                                borderRadius: '8px', width: '30px', height: '30px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', flexShrink: 0,
                                            }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                                <path d="M18 6L6 18M6 6l12 12" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Controls row */}
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {/* Qty */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                            <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: '34px', height: '34px', background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                                            <input
                                                type="number"
                                                min={1}
                                                value={item.qty}
                                                onChange={e => updateQty(item.id, parseInt(e.target.value) || 1)}
                                                style={{ width: '40px', background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', color: 'white', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit' }}
                                            />
                                            <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: '34px', height: '34px', background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                                        </div>

                                        {/* Unit Price */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', padding: '0 10px', height: '34px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>$</span>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={item.unitPrice}
                                                onChange={e => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                                style={{ width: '70px', background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit' }}
                                            />
                                        </div>

                                        {/* Discount */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,149,0,0.08)', borderRadius: '10px', border: '1px solid rgba(255,149,0,0.2)', padding: '0 10px', height: '34px' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                                <path d="M19 5L5 19M9 7a2 2 0 11-4 0 2 2 0 014 0zm10 10a2 2 0 11-4 0 2 2 0 014 0z" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={item.discount}
                                                onChange={e => updateDiscount(item.id, parseFloat(e.target.value) || 0)}
                                                style={{ width: '36px', background: 'transparent', border: 'none', outline: 'none', color: '#FF9500', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit' }}
                                            />
                                            <span style={{ color: '#FF9500', fontSize: '13px' }}>%</span>
                                        </div>

                                        {/* Line total */}
                                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                            <div style={{ color: '#34C759', fontSize: '16px', fontWeight: 700 }}>${formatUSD(total)}</div>
                                            <div style={{ fontSize: '11px', color: profitPct >= 20 ? 'rgba(52,199,89,0.7)' : 'rgba(255,149,0,0.7)' }}>
                                                Margen {profitPct.toFixed(0)}% · +${formatUSD(profit)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Notes ── */}
                {items.length > 0 && (
                    <div style={{ ...glass, padding: '16px', marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--label-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                            Notas / Condiciones
                        </label>
                        <p style={{ fontSize: '11px', color: 'var(--label-secondary)', opacity: 0.85, marginBottom: '8px', lineHeight: 1.4 }}>
                            Se envían a la vista previa e impresión. También puedes completar o corregir el texto en la pantalla de <strong>Vista previa</strong> antes de imprimir o compartir.
                        </p>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Condiciones de pago, tiempo de entrega, garantía, detalles del sitio…"
                            rows={3}
                            style={{
                                width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                                color: 'var(--label-primary)', fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.6,
                            }}
                        />
                    </div>
                )}

                {/* ── Payment Options ── */}
                {items.length > 0 && (
                    <div style={{ ...glass, padding: '16px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--label-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                    Información de Pago
                                </label>
                                <p style={{ fontSize: '14px', color: 'var(--label-primary)', fontWeight: 500 }}>
                                    Mostrar datos de Zelle en el presupuesto
                                </p>
                            </div>
                            <button
                                onClick={() => setShowZelle(!showZelle)}
                                style={{
                                    width: '50px',
                                    height: '26px',
                                    borderRadius: '13px',
                                    background: showZelle ? '#34C759' : 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    padding: '2px',
                                }}
                            >
                                <div style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '11px',
                                    background: 'white',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    transform: showZelle ? 'translateX(24px)' : 'translateX(0)',
                                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                }} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Summary Panel ── */}
                {items.length > 0 && (
                    <div style={{
                        ...glass,
                        padding: '20px',
                        background: 'rgba(0,0,0,0.4)',
                    }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                            Resumen del Presupuesto
                        </h3>

                        {/* Stats grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                            {[
                                { label: 'Costo Total', value: `$${formatUSD(totalCost)}`, color: '#FF3B30', icon: '📦' },
                                { label: 'Ganancia', value: `$${formatUSD(totalProfit)}`, color: '#34C759', icon: '💰' },
                                { label: 'Margen', value: `${marginPct.toFixed(1)}%`, color: marginPct >= 20 ? '#34C759' : '#FF9500', icon: '📊' },
                            ].map(s => (
                                <div key={s.label} style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '14px',
                                    padding: '14px',
                                    textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.icon}</div>
                                    <div style={{ color: s.color, fontSize: '16px', fontWeight: 700 }}>{s.value}</div>
                                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px' }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Line items summary */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginBottom: '16px' }}>
                            {items.map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ color: 'var(--label-primary)', fontSize: '13px', fontWeight: 500 }}>
                                            {item.qty}× {item.product.nombre.length > 40 ? item.product.nombre.slice(0, 40) + '…' : item.product.nombre}
                                        </span>
                                        {item.discount > 0 && (
                                            <span style={{ marginLeft: '6px', fontSize: '11px', color: '#FF9500' }}>(-{item.discount}%)</span>
                                        )}
                                    </div>
                                    <span style={{ color: '#34C759', fontSize: '13px', fontWeight: 600, flexShrink: 0, marginLeft: '12px' }}>
                                        ${formatUSD(lineTotal(item))}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '2px solid rgba(255,255,255,0.12)' }}>
                            <span style={{ color: 'var(--label-primary)', fontSize: '18px', fontWeight: 700 }}>TOTAL</span>
                            <span style={{ color: '#34C759', fontSize: '24px', fontWeight: 800 }}>${formatUSD(subtotal)}</span>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            <button
                                onClick={handleSaveBudget}
                                disabled={saving}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: 'rgba(0,122,255,0.15)',
                                    color: '#007AFF',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    opacity: saving ? 0.7 : 1,
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points="17 21 17 13 7 13 7 21" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points="7 3 7 8 15 8" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                                onClick={() => {
                                    if (!customerId) {
                                        alert('Selecciona un cliente de la lista antes de abrir la vista previa.');
                                        return;
                                    }
                                    // Guardar datos en localStorage y navegar a preview
                                    const presupuesto = {
                                        cliente: clientName,
                                        rif: clientRif,
                                        telefono: clientPhone,
                                        email: clientEmail,
                                        direccion: clientDireccion,
                                        notas: notes,
                                        items: items.map(i => ({
                                            nombre: i.product.nombre,
                                            categoria: i.product.categoria,
                                            qty: i.qty,
                                            unitPrice: i.unitPrice,
                                            discount: i.discount,
                                            costo: i.product.costo,
                                        })),
                                        subtotal,
                                        totalCost,
                                        totalProfit,
                                        marginPct,
                                        showZelle,
                                        fecha: new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' }),
                                        numero: budgetId ? `P-${budgetId.slice(0, 4)}` : `P-${Math.floor(Math.random() * 900) + 100}`,
                                    };
                                    localStorage.setItem('presupuesto_preview', JSON.stringify(presupuesto));
                                    window.open('/ventas/preview', '_blank');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #34C759, #30D158)',
                                    color: 'white',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 20px rgba(52,199,89,0.35)',
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="white" strokeWidth="2" />
                                    <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2" />
                                </svg>
                                Vista previa
                            </button>
                        </div>

                        {/* Clear button */}
                        <button
                            onClick={() => { if (confirm('¿Limpiar el presupuesto?')) setItems([]); }}
                            style={{
                                width: '100%',
                                marginTop: '10px',
                                padding: '10px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255,59,48,0.2)',
                                background: 'rgba(255,59,48,0.06)',
                                color: '#FF3B30',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                            }}
                        >
                            Limpiar presupuesto
                        </button>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media print {
          body { background: white !important; color: black !important; }
        }
      `}</style>
        </div>
    );
}

export default function VentasPage() {
    return (
        <Suspense>
            <VentasContent />
        </Suspense>
    );
}
