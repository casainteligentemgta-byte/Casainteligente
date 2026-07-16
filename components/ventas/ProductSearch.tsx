'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, Search, X, Package, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface ProductSearchProps {
    onSelect: (product: Product) => void;
}

function ProductRowThumb({ imagen, categoryColor }: { imagen: string | null | undefined; categoryColor: string }) {
    const [failed, setFailed] = useState(false);
    const url = typeof imagen === 'string' ? imagen.trim() : '';
    if (url && !failed) {
        return (
            <img
                src={url}
                alt=""
                width={36}
                height={36}
                onError={() => setFailed(true)}
                style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
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
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: `${categoryColor}22`,
                border: `1px solid ${categoryColor}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
            aria-hidden
        >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: categoryColor }} />
        </div>
    );
}

export default function ProductSearch({ onSelect }: ProductSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [activeIndex, setActiveIndex] = useState(-1);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const overlayInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const search = useCallback(async (q: string, cat: string) => {
        if (!isOverlayOpen && q.trim().length === 0) return;
        
        setLoading(true);

        let queryBuilder = supabase
            .from('products')
            .select(
                'id, external_id, nombre, categoria, modelo, marca, descripcion, costo, precio, utilidad, imagen, manual_instrucciones, manual_documento_url',
            );

        if (cat !== 'Todos') {
            queryBuilder = queryBuilder.eq('categoria', cat);
        }

        if (q.trim().length >= 1) {
            queryBuilder = queryBuilder.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%`);
        }

        const { data, error } = await queryBuilder
            .order('nombre')
            .limit(25);

        if (!error && data) {
            setResults(data);
        }
        setLoading(false);
    }, [supabase, isOverlayOpen]);

    useEffect(() => {
        const timer = setTimeout(() => search(query, selectedCategory), 300);
        return () => clearTimeout(timer);
    }, [query, selectedCategory, search]);

    const handleOpenOverlay = () => {
        setIsOverlayOpen(true);
        // Pequeño delay para asegurar que el ref esté disponible
        setTimeout(() => overlayInputRef.current?.focus(), 100);
    };

    const handleCloseOverlay = () => {
        setIsOverlayOpen(false);
        setQuery('');
        setResults([]);
    };

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

    const CATEGORIAS = ['Todos', 'Cámaras IP', 'Cámaras Análogas', 'C.C.T.V', 'Servicio', 'Cercos Eléctricos', 'Internet', 'Domótica', 'Network', 'Materiales', 'Herramientas'];

    const getCategoryColor = (cat: string | null) => {
        const map: Record<string, string> = {
            'Cámaras IP': '#007AFF',
            'Cámaras Análogas': '#5856D6',
            'C.C.T.V': '#5856D6',
            'Servicio': '#34C759',
            'Cercos Eléctricos': '#FF9500',
            'Internet': '#00C7BE',
            'Domótica': '#FF2D55',
            'Network': '#00C7BE',
            'Materiales': '#8E8E93',
            'Herramientas': '#FF9500',
        };
        return map[cat ?? ''] ?? '#8E8E93';
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            {/* Category Chips */}
            <div style={{
                overflowX: 'auto',
                marginBottom: '10px',
                paddingBottom: '4px',
                display: 'flex',
                gap: '8px',
                WebkitOverflowScrolling: 'touch'
            }}>
                {CATEGORIAS.map(cat => {
                    const active = selectedCategory === cat;
                    const color = getCategoryColor(cat === 'Todos' ? null : cat);
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
                            <ProductRowThumb imagen={p.imagen} categoryColor={getCategoryColor(p.categoria)} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: 'white', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {p.nombre}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                    {p.marca && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{p.marca}</span>}
                                    {p.modelo && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>· {p.modelo}</span>}
                                    {p.categoria && <span style={{ fontSize: '11px', color: getCategoryColor(p.categoria), opacity: 0.8 }}>· {p.categoria}</span>}
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
                    padding: '14px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
            >
                <Search size={20} color="rgba(255,255,255,0.4)" />
                <span style={{ color: 'rgba(255,255,255,0.3)', flex: 1, fontSize: '15px' }}>
                    Buscar productos...
                </span>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <ChevronDown size={18} color="rgba(255,255,255,0.5)" />
                </div>
            </div>

            {/* ── Full Screen Overlay ── */}
            <AnimatePresence>
                {isOverlayOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.02, y: -10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 9999,
                            background: 'var(--bg-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {/* Header Search Bar */}
                        <div style={{
                            padding: '16px 20px',
                            background: 'rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(30px)',
                            WebkitBackdropFilter: 'blur(30px)',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                        }}>
                            <button 
                                onClick={handleCloseOverlay}
                                style={{ background: 'none', border: 'none', padding: '8px', color: 'white', display: 'flex' }}
                            >
                                <ArrowLeft size={24} />
                            </button>
                            
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                padding: '10px 14px',
                            }}>
                                <Search size={18} color="#007AFF" />
                                <input
                                    ref={overlayInputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Nombre, marca o modelo..."
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'white',
                                        fontSize: '16px',
                                        fontFamily: 'inherit',
                                    }}
                                />
                                {query && (
                                    <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)' }}>
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Category Selector */}
                        <div style={{
                            padding: '14px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            gap: '8px',
                            overflowX: 'auto',
                            paddingLeft: '20px',
                            paddingRight: '20px',
                            scrollbarWidth: 'none',
                        }}>
                            {CATEGORIAS.map(cat => {
                                const active = selectedCategory === cat;
                                const color = getCategoryColor(cat === 'Todos' ? null : cat);
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '20px',
                                            background: active ? `${color}22` : 'rgba(255,255,255,0.05)',
                                            border: active ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.1)',
                                            color: active ? color : 'rgba(255,255,255,0.4)',
                                            fontSize: '13px',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Results List */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
                            {loading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                                    Cargando productos...
                                </div>
                            ) : results.length > 0 ? (
                                results.map((p, idx) => (
                                    <motion.button
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        key={p.id}
                                        onClick={() => handleSelect(p)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '14px',
                                            width: '100%',
                                            padding: '14px 20px',
                                            background: 'none',
                                            border: 'none',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            textAlign: 'left',
                                        }}
                                    >
                                        {p.image_url || p.imagen ? (
                                            <img
                                                src={p.image_url || p.imagen || ''}
                                                style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover' }}
                                                alt={p.nombre}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '44px', height: '44px', borderRadius: '12px',
                                                background: `${getCategoryColor(p.categoria)}22`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Package size={20} color={getCategoryColor(p.categoria)} />
                                            </div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: 'white', fontSize: '15px', fontWeight: 600, marginBottom: '2px' }}>
                                                {p.nombre}
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                                                {p.marca && <span>{p.marca}</span>}
                                                {p.modelo && <span>· {p.modelo}</span>}
                                                {p.categoria && <span style={{ color: getCategoryColor(p.categoria) }}>· {p.categoria}</span>}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: '#34C759', fontSize: '16px', fontWeight: 700 }}>
                                                ${p.precio?.toFixed(2) ?? '0.00'}
                                            </div>
                                        </div>
                                    </motion.button>
                                ))
                            ) : query.length > 0 ? (
                                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔍</div>
                                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>
                                        No encontramos "{query}"
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>📦</div>
                                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '15px' }}>
                                        Escribe para buscar productos
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                ::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}
