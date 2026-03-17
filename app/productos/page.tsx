'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Product {
    id: number;
    nombre: string;
    categoria: string | null;
    modelo: string | null;
    marca: string | null;
    descripcion: string | null;
    costo: number | null;
    precio: number | null;
    utilidad: number | null;
    cantidad: number | null;
    imagen: string | null;
    ubicacion?: string | null;
}

const CATEGORIAS_COMERCIALES = ['Cámaras IP', 'Cámaras Análogas', 'C.C.T.V', 'Servicio', 'Cercos Eléctricos', 'Internet', 'Domótica', 'Network'];
const CATEGORIAS_INTERNAS = ['Herramientas', 'Insumos', 'Consumibles', 'Materiales'];
const CATEGORIAS = ['Todas', ...CATEGORIAS_COMERCIALES];

const CAT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    'Cámaras IP': { bg: 'rgba(0,122,255,0.12)', text: '#007AFF', dot: '#007AFF' },
    'Cámaras Análogas': { bg: 'rgba(88,86,214,0.12)', text: '#5856D6', dot: '#5856D6' },
    'C.C.T.V': { bg: 'rgba(88,86,214,0.12)', text: '#5856D6', dot: '#5856D6' },
    'Servicio': { bg: 'rgba(52,199,89,0.12)', text: '#34C759', dot: '#34C759' },
    'Cercos Eléctricos': { bg: 'rgba(255,149,0,0.12)', text: '#FF9500', dot: '#FF9500' },
    'Internet': { bg: 'rgba(0,199,190,0.12)', text: '#00C7BE', dot: '#00C7BE' },
    'Domótica': { bg: 'rgba(255,45,85,0.12)', text: '#FF2D55', dot: '#FF2D55' },
    'Network': { bg: 'rgba(0,199,190,0.12)', text: '#00C7BE', dot: '#00C7BE' },
    'Materiales': { bg: 'rgba(142,142,147,0.12)', text: '#8E8E93', dot: '#8E8E93' },
    'Herramientas': { bg: 'rgba(255,149,0,0.12)', text: '#FF9500', dot: '#FF9500' },
    'Insumos': { bg: 'rgba(175,82,222,0.12)', text: '#AF52DE', dot: '#AF52DE' },
};

function fmt(n: number | null) {
    if (n == null) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProductAvatar({ product }: { product: Product }) {
    const cat = product.categoria ?? '';
    const color = CAT_COLORS[cat]?.dot ?? '#8E8E93';
    const initials = (product.nombre || '??').slice(0, 2).toUpperCase();

    if (product.imagen) {
        return (
            <img
                src={product.imagen}
                alt={product.nombre}
                style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover', flexShrink: 0 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
        );
    }

    return (
        <div style={{
            width: '56px', height: '56px', borderRadius: '14px', flexShrink: 0,
            background: `${color}22`, border: `1.5px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '2px',
        }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, opacity: 0.8 }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color, letterSpacing: '0.5px' }}>{initials}</span>
        </div>
    );
}

interface CartItem { product: Product; qty: number; }

function ProductRow({
    product, onTap, onAddToCart, onDelete, inCart,
}: {
    product: Product;
    onTap: () => void;
    onAddToCart: (p: Product) => void;
    onDelete: (id: number) => void;
    inCart: boolean;
}) {
    const cat = product.categoria ?? '';
    const colors = CAT_COLORS[cat] ?? { bg: 'rgba(142,142,147,0.12)', text: '#8E8E93', dot: '#8E8E93' };
    const [confirmDel, setConfirmDel] = useState(false);

    const handleDelete = () => {
        if (confirmDel) { onDelete(product.id); }
        else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); }
    };

    return (
        <div style={{
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'transparent',
        }}>
            {/* ── Info row (clickable) ── */}
            <button
                onClick={onTap}
                style={{
                    width: '100%', padding: '16px', display: 'flex', gap: '14px',
                    textAlign: 'left', background: 'transparent', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit'
                }}
            >
                <ProductAvatar product={product} />

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <span style={{
                            fontSize: '10px', fontWeight: 800, padding: '2px 8px',
                            borderRadius: '6px', background: colors.bg, color: colors.text,
                            textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                            {cat}
                        </span>
                        {product.marca && (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                                {product.marca}
                            </span>
                        )}
                    </div>

                    <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 700, lineHeight: 1.2, marginBottom: '2px' }}>
                        {product.nombre}
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                        {product.modelo || 'Sin modelo'}
                    </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#34C759', fontSize: '18px', fontWeight: 800 }}>
                        ${fmt(product.precio)}
                    </div>
                </div>
            </button>

            {/* ── Action bar ── */}
            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)', margin: '0 16px', marginBottom: '2px' }}>
                <button
                    onClick={() => onAddToCart(product)}
                    style={{
                        flex: 2, padding: '8px 0',
                        background: inCart ? 'rgba(52,199,89,0.12)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        color: inCart ? '#34C759' : 'rgba(255,255,255,0.4)',
                        fontSize: '11px', fontWeight: 600,
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        transition: 'all 0.15s',
                    }}
                >
                    {inCart ? 'En presupuesto ✓' : 'Al presupuesto'}
                </button>

                <Link
                    href={`/productos/${product.id}/editar`}
                    style={{
                        flex: 1, padding: '8px 0',
                        background: 'transparent',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        textDecoration: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        color: '#FF9500', fontSize: '11px', fontWeight: 600,
                    }}
                >
                    Editar
                </Link>

                <button
                    onClick={handleDelete}
                    style={{
                        flex: 1, padding: '8px 0',
                        background: confirmDel ? 'rgba(255,59,48,0.10)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        color: '#FF3B30', fontSize: '11px', fontWeight: 600,
                    }}
                >
                    {confirmDel ? '¿Seguro?' : 'Eliminar'}
                </button>
            </div>
        </div>
    );
}

function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'flex-end',
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '600px', margin: '0 auto',
                    background: '#1C1C1E', borderRadius: '32px 32px 0 0',
                    padding: '30px 24px 50px',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                }}
            >
                <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 20px' }} />
                <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>{product.nombre}</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', marginBottom: '24px' }}>{product.descripcion}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 700 }}>PRECIO VENTA</p>
                        <p style={{ color: '#34C759', fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>${fmt(product.precio)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ProductosPage() {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoria, setCategoria] = useState('Todas');
    const [selected, setSelected] = useState<Product | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('cart_ventas');
        if (saved) setCart(JSON.parse(saved));
    }, []);

    useEffect(() => {
        localStorage.setItem('cart_ventas', JSON.stringify(cart));
    }, [cart]);

    const addToCart = useCallback((product: Product) => {
        setCart(prev => {
            if (prev.some(i => i.product.id === product.id)) {
                return prev.filter(i => i.product.id !== product.id);
            }
            return [...prev, { product, qty: 1 }];
        });
    }, []);

    const deleteProduct = useCallback(async (id: number) => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (!error) {
            setProducts(prev => prev.filter(p => p.id !== id));
            setTotal(t => t - 1);
        }
    }, [supabase]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('products')
            .select('*', { count: 'exact' })
            .order('nombre');

        if (search.trim().length >= 2) {
            query = query.or(`nombre.ilike.%${search}%,marca.ilike.%${search}%,modelo.ilike.%${search}%`);
        }
        if (categoria !== 'Todas') {
            query = query.eq('categoria', categoria);
        }

        const { data, error, count } = await query.limit(100);
        if (!error && data) {
            let filteredResult = data;
            if (categoria === 'Todas') {
                filteredResult = data.filter(p => !CATEGORIAS_INTERNAS.includes(p.categoria || ''));
            }
            setProducts(filteredResult);
            setTotal(count ?? filteredResult.length);
        }
        setLoading(false);
    }, [search, categoria, supabase]);

    useEffect(() => {
        const t = setTimeout(fetchProducts, search ? 350 : 0);
        return () => clearTimeout(t);
    }, [fetchProducts, search]);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
            <div style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)',
                padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 800 }}>Catálogo</h1>
                <Link href="/productos/nuevo">
                    <button style={{
                        background: '#FF9500', color: 'white', border: 'none',
                        borderRadius: '12px', padding: '10px 16px', fontWeight: 700,
                        fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,149,0,0.3)'
                    }}>
                        + Nuevo
                    </button>
                </Link>
            </div>

            <div style={{ padding: '20px' }}>
                <input
                    type="text"
                    placeholder="Buscar producto comercial..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%', marginBottom: '16px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px', padding: '12px 16px', color: 'white', outline: 'none'
                    }}
                />

                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px' }}>
                    {CATEGORIAS.map(c => (
                        <button
                            key={c}
                            onClick={() => setCategoria(c)}
                            style={{
                                background: categoria === c ? 'rgba(255,149,0,0.15)' : 'transparent',
                                color: categoria === c ? '#FF9500' : 'rgba(255,255,255,0.4)',
                                border: 'none', borderRadius: '10px', padding: '6px 14px',
                                fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
                            }}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Cargando catálogo...</div>
                    ) : products.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>Sin resultados</div>
                    ) : (
                        products.map(p => (
                            <ProductRow
                                key={p.id}
                                product={p}
                                onTap={() => setSelected(p)}
                                onAddToCart={addToCart}
                                onDelete={deleteProduct}
                                inCart={cart.some(items => items.product.id === p.id)}
                            />
                        ))
                    )}
                </div>
            </div>

            {selected && <ProductDetail product={selected} onClose={() => setSelected(null)} />}

            {cart.length > 0 && (
                <div style={{ position: 'fixed', bottom: '100px', left: '20px', right: '20px', zIndex: 110 }}>
                    <button
                        onClick={() => router.push(`/ventas?productos=${cart.map(i => i.product.id).join(',')}`)}
                        style={{
                            width: '100%', background: '#34C759', padding: '18px',
                            color: 'white', fontSize: '17px', fontWeight: 700, border: 'none',
                            borderRadius: '18px', boxShadow: '0 8px 25px rgba(52,199,89,0.4)',
                            cursor: 'pointer'
                        }}
                    >
                        🛒 Crear presupuesto ({cart.length})
                    </button>
                </div>
            )}
        </div>
    );
}
