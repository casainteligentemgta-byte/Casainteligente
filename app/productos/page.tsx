'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import ModuloPageTitle from '@/components/ui/ModuloPageTitle';
import { createClient } from '@/lib/supabase/client';
import { coloresCategoria } from '@/lib/productos/categoriasCatalogo';
import { useCategoriasCatalogo } from '@/lib/productos/useCategoriasCatalogo';

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
    manual_instrucciones?: string | null;
    manual_documento_url?: string | null;
}

const PAGE_SIZE = 500;

function fmt(n: number | null) {
    if (n == null) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Miniatura en catálogo: foto del producto si hay URL válida; si no, identidad por categoría/iniciales. */
function ProductAvatar({ product }: { product: Product }) {
    const cat = product.categoria ?? '';
    const color = coloresCategoria(cat).dot;
    const initials = (product.nombre || '??').slice(0, 2).toUpperCase();
    const [imgFailed, setImgFailed] = useState(false);
    const src = product.imagen?.trim();

    if (src && !imgFailed) {
        return (
            <div
                style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    flexShrink: 0,
                    overflow: 'hidden',
                    border: `1.5px solid ${color}44`,
                    background: 'rgba(0,0,0,0.35)',
                }}
            >
                <img
                    src={src}
                    alt=""
                    onError={() => setImgFailed(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
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
    const colors = coloresCategoria(cat);
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
                    width: '100%', padding: '16px', display: 'flex', gap: '12px',
                    textAlign: 'left', background: 'transparent', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    alignItems: 'flex-start',
                    boxSizing: 'border-box',
                }}
            >
                <ProductAvatar product={product} />

                <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '10px',
                            marginBottom: '4px',
                        }}
                    >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minWidth: 0, flex: 1 }}>
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
                        <div
                            style={{
                                color: '#34C759',
                                fontSize: '17px',
                                fontWeight: 800,
                                lineHeight: 1.15,
                                flexShrink: 0,
                                textAlign: 'right',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            ${fmt(product.precio)}
                        </div>
                    </div>

                    <h3
                        style={{
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 700,
                            lineHeight: 1.25,
                            margin: '0 0 2px 0',
                            textAlign: 'justify',
                            textAlignLast: 'left',
                            hyphens: 'auto',
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                        }}
                    >
                        {product.nombre}
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                        {product.modelo || 'Sin modelo'}
                    </p>
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
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 20px' }} />
                {product.imagen ? (
                    <img
                        src={product.imagen}
                        alt=""
                        style={{
                            width: '100%',
                            maxHeight: '200px',
                            objectFit: 'contain',
                            borderRadius: '16px',
                            marginBottom: '16px',
                            background: 'rgba(0,0,0,0.4)',
                        }}
                    />
                ) : null}
                <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>{product.nombre}</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', marginBottom: '24px', whiteSpace: 'pre-wrap' }}>{product.descripcion || 'Sin descripción.'}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 700 }}>PRECIO VENTA</p>
                        <p style={{ color: '#34C759', fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>${fmt(product.precio)}</p>
                    </div>
                </div>

                {(product.manual_instrucciones || product.manual_documento_url) ? (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700, marginBottom: '10px' }}>MANUAL E INSTRUCCIONES</p>
                        {product.manual_documento_url ? (
                            <a
                                href={product.manual_documento_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-block',
                                    marginBottom: '12px',
                                    padding: '10px 16px',
                                    borderRadius: '12px',
                                    background: 'rgba(0,122,255,0.2)',
                                    color: '#5AC8FA',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                }}
                            >
                                📄 Abrir manual (PDF)
                            </a>
                        ) : null}
                        {product.manual_instrucciones ? (
                            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                                {product.manual_instrucciones}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function ProductosPage() {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const { nombres: categoriasNombres, crear: crearCategoria } = useCategoriasCatalogo();
    const categorias = useMemo(() => ['Todas', ...categoriasNombres], [categoriasNombres]);
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoria, setCategoria] = useState('Todas');
    const [selected, setSelected] = useState<Product | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [creandoCategoria, setCreandoCategoria] = useState(false);
    const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState('');
    const [guardandoCategoria, setGuardandoCategoria] = useState(false);
    const [errorCategoria, setErrorCategoria] = useState<string | null>(null);

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

    const guardarNuevaCategoria = useCallback(async () => {
        setGuardandoCategoria(true);
        setErrorCategoria(null);
        try {
            const creada = await crearCategoria(nombreNuevaCategoria);
            setCategoria(creada);
            setCreandoCategoria(false);
            setNombreNuevaCategoria('');
        } catch (err) {
            setErrorCategoria(err instanceof Error ? err.message : 'No se pudo crear');
        } finally {
            setGuardandoCategoria(false);
        }
    }, [crearCategoria, nombreNuevaCategoria]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        const q = search.trim();
        const collected: Product[] = [];
        let from = 0;
        let totalCount = 0;
        let failed = false;

        while (from < 20_000) {
            let query = supabase
                .from('products')
                .select('*', { count: 'exact' })
                .order('nombre')
                .range(from, from + PAGE_SIZE - 1);

            if (q.length >= 2) {
                query = query.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%`);
            }
            if (categoria !== 'Todas') {
                query = query.eq('categoria', categoria);
            }

            const { data, error, count } = await query;
            if (error) {
                failed = true;
                break;
            }
            totalCount = count ?? totalCount;
            collected.push(...((data ?? []) as Product[]));
            if (!data || data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }

        if (!failed) {
            setProducts(collected);
            setTotal(totalCount || collected.length);
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
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
            }}>
                <ModuloPageTitle
                    title="Catálogo"
                    icon={Package}
                    iconClassName="text-orange-400"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {cart.length > 0 ? (
                        <button
                            type="button"
                            onClick={() =>
                                router.push(`/ventas?productos=${cart.map((i) => i.product.id).join(',')}`)
                            }
                            style={{
                                background: '#34C759',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                padding: '10px 14px',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(52,199,89,0.3)',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            🛒 Presupuesto ({cart.length})
                        </button>
                    ) : null}
                    <Link href="/productos/nuevo">
                        <button
                            type="button"
                            style={{
                                background: '#FF9500',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                padding: '10px 16px',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(255,149,0,0.3)',
                            }}
                        >
                            + Nuevo
                        </button>
                    </Link>
                </div>
            </div>

            <div style={{ padding: '20px' }}>
                <input
                    type="text"
                    placeholder="Buscar producto o material..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%', marginBottom: '16px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px', padding: '12px 16px', color: 'white', outline: 'none'
                    }}
                />

                <div
                    style={{
                        display: 'flex',
                        gap: '8px',
                        overflowX: 'auto',
                        paddingBottom: '12px',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'thin',
                        alignItems: 'center',
                    }}
                >
                    {categorias.map(c => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setCategoria(c)}
                            style={{
                                background: categoria === c ? 'rgba(255,149,0,0.15)' : 'transparent',
                                color: categoria === c ? '#FF9500' : 'rgba(255,255,255,0.4)',
                                border: 'none', borderRadius: '10px', padding: '6px 14px',
                                fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                                flexShrink: 0,
                            }}
                        >
                            {c}
                        </button>
                    ))}
                    {creandoCategoria ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <input
                                type="text"
                                value={nombreNuevaCategoria}
                                onChange={(e) => setNombreNuevaCategoria(e.target.value)}
                                placeholder="Nueva categoría"
                                autoFocus
                                disabled={guardandoCategoria}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void guardarNuevaCategoria();
                                    }
                                    if (e.key === 'Escape') {
                                        setCreandoCategoria(false);
                                        setErrorCategoria(null);
                                    }
                                }}
                                style={{
                                    width: '160px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,149,0,0.45)',
                                    borderRadius: '10px',
                                    padding: '6px 10px',
                                    color: 'white',
                                    outline: 'none',
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                }}
                            />
                            <button
                                type="button"
                                disabled={guardandoCategoria}
                                onClick={() => void guardarNuevaCategoria()}
                                style={{
                                    background: 'rgba(52,199,89,0.18)',
                                    color: '#34C759',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '6px 12px',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    cursor: guardandoCategoria ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {guardandoCategoria ? '…' : 'Crear'}
                            </button>
                            <button
                                type="button"
                                disabled={guardandoCategoria}
                                onClick={() => {
                                    setCreandoCategoria(false);
                                    setErrorCategoria(null);
                                    setNombreNuevaCategoria('');
                                }}
                                style={{
                                    background: 'transparent',
                                    color: 'rgba(255,255,255,0.45)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '6px 8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                setCreandoCategoria(true);
                                setErrorCategoria(null);
                            }}
                            style={{
                                background: 'transparent',
                                color: '#FF9500',
                                border: '1px dashed rgba(255,149,0,0.45)',
                                borderRadius: '10px',
                                padding: '6px 12px',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                fontFamily: 'inherit',
                            }}
                        >
                            + Categoría
                        </button>
                    )}
                </div>
                {errorCategoria ? (
                    <p style={{ margin: '-4px 0 12px', fontSize: '12px', color: '#FF8A80', fontWeight: 600 }}>
                        {errorCategoria}
                    </p>
                ) : null}

                {!loading && total > 0 ? (
                    <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                        {products.length === total
                            ? `${total} producto${total === 1 ? '' : 's'}`
                            : `Mostrando ${products.length} de ${total}`}
                    </p>
                ) : null}

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
        </div>
    );
}
