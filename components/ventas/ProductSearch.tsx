'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Product {
    id: number;
    external_id: number | null;
    nombre: string;
    categoria: string | null;
    modelo: string | null;
    marca: string | null;
    descripcion: string | null;
    costo: number | null;
    precio: number | null;
    utilidad: number | null;
    imagen?: string | null;
    manual_instrucciones?: string | null;
    manual_documento_url?: string | null;
}

export type ModoSelectorProducto = 'botones' | 'lista';

const MODO_STORAGE_KEY = 'ci-presupuesto-selector-modo-v1';

const CATEGORIAS_LISTA = [
    'Todos',
    'Cámaras IP',
    'Cámaras Análogas',
    'C.C.T.V',
    'Servicio',
    'Cercos Eléctricos',
    'Internet',
    'Domótica',
    'Network',
    'Herramientas',
    'Insumos',
    'Consumibles',
    'Materiales',
] as const;

const CATEGORIAS_BOTONES = CATEGORIAS_LISTA.filter((c) => c !== 'Todos');

const COLOR_CATEGORIA: Record<string, string> = {
    'Cámaras IP': '#007AFF',
    'Cámaras Análogas': '#5856D6',
    'C.C.T.V': '#5856D6',
    Servicio: '#34C759',
    'Cercos Eléctricos': '#FF9500',
    Internet: '#00C7BE',
    Domótica: '#FF2D55',
    Network: '#00C7BE',
    Materiales: '#8E8E93',
    Herramientas: '#FF9500',
    Insumos: '#AF52DE',
    Consumibles: '#5AC8FA',
};

function colorCategoria(cat: string | null) {
    return COLOR_CATEGORIA[cat ?? ''] ?? '#8E8E93';
}

function leerModoGuardado(): ModoSelectorProducto {
    if (typeof window === 'undefined') return 'botones';
    try {
        const raw = localStorage.getItem(MODO_STORAGE_KEY);
        return raw === 'lista' ? 'lista' : 'botones';
    } catch {
        return 'botones';
    }
}

export type SelectProductoOpts = { keepOpen?: boolean };

interface ProductSearchProps {
    onSelect: (product: Product, opts?: SelectProductoOpts) => void;
    /** Cantidad ya cargada en el presupuesto, para marcar botones. */
    inBudgetQtyById?: Record<number, number>;
}

function ProductRowThumb({
    imagen,
    categoryColor,
    size = 36,
}: {
    imagen: string | null | undefined;
    categoryColor: string;
    size?: number;
}) {
    const [failed, setFailed] = useState(false);
    const url = typeof imagen === 'string' ? imagen.trim() : '';
    if (url && !failed) {
        return (
            <img
                src={url}
                alt=""
                width={size}
                height={size}
                onError={() => setFailed(true)}
                style={{
                    width: size,
                    height: size,
                    borderRadius: size > 40 ? '14px' : '10px',
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: `1px solid ${categoryColor}44`,
                    background: 'rgba(0,0,0,0.35)',
                }}
            />
        );
    }
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: size > 40 ? '14px' : '10px',
                background: `${categoryColor}22`,
                border: `1px solid ${categoryColor}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
            aria-hidden
        >
            <div
                style={{
                    width: size > 40 ? 12 : 8,
                    height: size > 40 ? 12 : 8,
                    borderRadius: '50%',
                    background: categoryColor,
                }}
            />
        </div>
    );
}

function ToggleModo({
    modo,
    onChange,
}: {
    modo: ModoSelectorProducto;
    onChange: (m: ModoSelectorProducto) => void;
}) {
    const btn = (id: ModoSelectorProducto, label: string) => {
        const active = modo === id;
        return (
            <button
                type="button"
                onClick={() => onChange(id)}
                aria-pressed={active}
                style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 10,
                    background: active ? 'rgba(255,149,0,0.18)' : 'transparent',
                    color: active ? '#FF9500' : 'rgba(255,255,255,0.45)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                }}
            >
                {label}
            </button>
        );
    };
    return (
        <div
            role="group"
            aria-label="Modo de selección de productos"
            style={{
                display: 'flex',
                gap: 4,
                marginBottom: 12,
                padding: 4,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            {btn('botones', 'Botones')}
            {btn('lista', 'Lista')}
        </div>
    );
}

export default function ProductSearch({ onSelect, inBudgetQtyById }: ProductSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [activeIndex, setActiveIndex] = useState(-1);
    const [modo, setModo] = useState<ModoSelectorProducto>('botones');
    const [tipoBoton, setTipoBoton] = useState<string | null>(null);
    const [productosBoton, setProductosBoton] = useState<Product[]>([]);
    const [cargandoBoton, setCargandoBoton] = useState(false);
    const [filtroBoton, setFiltroBoton] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    useEffect(() => {
        setModo(leerModoGuardado());
    }, []);

    const cambiarModo = (m: ModoSelectorProducto) => {
        setModo(m);
        try {
            localStorage.setItem(MODO_STORAGE_KEY, m);
        } catch {
            /* ignore */
        }
    };

    useEffect(() => {
        if (modo !== 'botones' || !tipoBoton) {
            setProductosBoton([]);
            return;
        }
        let cancelado = false;
        setCargandoBoton(true);
        void supabase
            .from('products')
            .select(
                'id, external_id, nombre, categoria, modelo, marca, descripcion, costo, precio, utilidad, imagen, manual_instrucciones, manual_documento_url',
            )
            .eq('categoria', tipoBoton)
            .order('nombre')
            .limit(200)
            .then(({ data, error }) => {
                if (cancelado) return;
                setProductosBoton(!error && data ? (data as Product[]) : []);
                setCargandoBoton(false);
            });
        return () => {
            cancelado = true;
        };
    }, [modo, tipoBoton, supabase]);

    const search = useCallback(async (q: string, cat: string) => {
        if (q.trim().length < 2 && cat === 'Todos') {
            setResults([]);
            setOpen(false);
            return;
        }
        setLoading(true);

        let queryBuilder = supabase
            .from('products')
            .select(
                'id, external_id, nombre, categoria, modelo, marca, descripcion, costo, precio, utilidad, imagen, manual_instrucciones, manual_documento_url',
            );

        if (cat !== 'Todos') {
            queryBuilder = queryBuilder.eq('categoria', cat);
        }

        if (q.trim().length >= 2) {
            queryBuilder = queryBuilder.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%`);
        }

        const { data, error } = await queryBuilder
            .order('nombre')
            .limit(100);

        if (!error && data) {
            setResults(data);
            setOpen(true);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        if (modo !== 'lista') return;
        const timer = setTimeout(() => search(query, selectedCategory), 300);
        return () => clearTimeout(timer);
    }, [query, selectedCategory, search, modo]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current && !inputRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (product: Product) => {
        onSelect(product);
        // Mantener la palabra de búsqueda para seguir agregando ítems del mismo criterio; solo se borra con la X.
        setOpen(false);
        setActiveIndex(-1);
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            handleSelect(results[activeIndex]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const productosFiltradosBoton = filtroBoton.trim().length < 1
        ? productosBoton
        : productosBoton.filter((p) => {
            const q = filtroBoton.trim().toLowerCase();
            return (
                p.nombre.toLowerCase().includes(q) ||
                (p.marca ?? '').toLowerCase().includes(q) ||
                (p.modelo ?? '').toLowerCase().includes(q)
            );
        });

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <ToggleModo modo={modo} onChange={cambiarModo} />

            {modo === 'botones' ? (
                <div>
                    {tipoBoton ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setTipoBoton(null);
                                    setFiltroBoton('');
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: 'rgba(255,255,255,0.8)',
                                    borderRadius: 10,
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                ← Tipos
                            </button>
                            <span style={{ color: colorCategoria(tipoBoton), fontWeight: 800, fontSize: 15 }}>
                                {tipoBoton}
                            </span>
                        </div>
                    ) : (
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                            Elija el tipo y luego toque el producto.
                        </p>
                    )}

                    {!tipoBoton ? (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: 8,
                            }}
                        >
                            {CATEGORIAS_BOTONES.map((cat) => {
                                const color = colorCategoria(cat);
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setTipoBoton(cat)}
                                        style={{
                                            minHeight: 56,
                                            padding: '12px 10px',
                                            borderRadius: 14,
                                            border: `1.5px solid ${color}55`,
                                            background: `${color}18`,
                                            color,
                                            fontSize: 14,
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            textAlign: 'center',
                                        }}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <>
                            <input
                                type="search"
                                value={filtroBoton}
                                onChange={(e) => setFiltroBoton(e.target.value)}
                                placeholder="Filtrar en esta categoría…"
                                style={{
                                    width: '100%',
                                    marginBottom: 10,
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: 12,
                                    padding: '10px 12px',
                                    color: 'white',
                                    outline: 'none',
                                    fontSize: 14,
                                    fontFamily: 'inherit',
                                }}
                            />
                            {cargandoBoton ? (
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                                    Cargando productos…
                                </p>
                            ) : productosFiltradosBoton.length === 0 ? (
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                                    No hay productos en {tipoBoton}.
                                </p>
                            ) : (
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                        gap: 8,
                                        maxHeight: 420,
                                        overflowY: 'auto',
                                        paddingBottom: 4,
                                    }}
                                >
                                    {productosFiltradosBoton.map((p) => {
                                        const color = colorCategoria(p.categoria);
                                        const qty = inBudgetQtyById?.[p.id] ?? 0;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => onSelect(p, { keepOpen: true })}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'flex-start',
                                                    gap: 8,
                                                    minHeight: 96,
                                                    padding: 10,
                                                    borderRadius: 14,
                                                    border: qty > 0 ? '1.5px solid #34C759' : '1.5px solid rgba(255,255,255,0.1)',
                                                    background: qty > 0 ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.04)',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    fontFamily: 'inherit',
                                                }}
                                            >
                                                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 6 }}>
                                                    <ProductRowThumb imagen={p.imagen} categoryColor={color} size={44} />
                                                    {qty > 0 ? (
                                                        <span style={{ color: '#34C759', fontSize: 11, fontWeight: 800 }}>
                                                            ×{qty}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <span
                                                    style={{
                                                        color: 'white',
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        lineHeight: 1.25,
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    {p.nombre}
                                                </span>
                                                <span style={{ color: '#34C759', fontSize: 13, fontWeight: 700 }}>
                                                    ${p.precio?.toFixed(2) ?? '—'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : (
            <>
            {/* Category Chips */}
            <div style={{
                overflowX: 'auto',
                marginBottom: '10px',
                paddingBottom: '4px',
                display: 'flex',
                gap: '8px',
                WebkitOverflowScrolling: 'touch'
            }}>
                {CATEGORIAS_LISTA.map(cat => {
                    const active = selectedCategory === cat;
                    const color = colorCategoria(cat === 'Todos' ? null : cat);
                    return (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '18px',
                                background: active ? `${color}22` : 'rgba(255,255,255,0.05)',
                                border: active ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.08)',
                                color: active ? color : 'rgba(255,255,255,0.4)',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit'
                            }}
                        >
                            {cat}
                        </button>
                    );
                })}
            </div>

            {/* Search Input */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '14px',
                padding: '12px 16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>
                {loading ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                        <path d="M16.5 16.5L21 21" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                )}
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (query.trim().length >= 2 && results.length > 0) setOpen(true);
                    }}
                    placeholder="Buscar producto por nombre, marca o modelo..."
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--label-primary)',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                    }}
                />
                {query && (
                    <button
                        type="button"
                        aria-label="Borrar búsqueda"
                        title="Borrar búsqueda"
                        onClick={() => {
                            setQuery('');
                            setResults([]);
                            setOpen(false);
                            setActiveIndex(-1);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.4)', display: 'flex' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.15)" />
                            <path d="M8 8l8 8M16 8l-8 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {open && results.length > 0 && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        background: 'rgba(28,28,30,0.95)',
                        backdropFilter: 'blur(30px)',
                        WebkitBackdropFilter: 'blur(30px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        maxHeight: '340px',
                        overflowY: 'auto',
                    }}
                >
                    <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                            {results.length} resultado{results.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {results.map((p, i) => (
                        <button
                            key={p.id}
                            onClick={() => handleSelect(p)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                width: '100%',
                                padding: '12px 14px',
                                background: i === activeIndex ? 'rgba(0,122,255,0.15)' : 'transparent',
                                border: 'none',
                                borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={() => setActiveIndex(i)}
                        >
                            <ProductRowThumb imagen={p.imagen} categoryColor={colorCategoria(p.categoria)} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: 'white', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {p.nombre}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                    {p.marca && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{p.marca}</span>}
                                    {p.modelo && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>· {p.modelo}</span>}
                                    {p.categoria && <span style={{ fontSize: '11px', color: colorCategoria(p.categoria), opacity: 0.8 }}>· {p.categoria}</span>}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ color: '#34C759', fontSize: '14px', fontWeight: 600 }}>
                                    ${p.precio?.toFixed(2) ?? '—'}
                                </div>
                                {p.utilidad != null && (
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                                        +${p.utilidad.toFixed(0)} margen
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {open && query.length >= 2 && results.length === 0 && !loading && (
                <div ref={dropdownRef} style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    background: 'rgba(28,28,30,0.95)',
                    backdropFilter: 'blur(30px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '16px',
                    padding: '24px',
                    textAlign: 'center',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Sin resultados para &ldquo;{query}&rdquo;</div>
                </div>
            )}
            </>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
