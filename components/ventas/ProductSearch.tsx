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
    image_url: string | null;
    imagen: string | null;
}

interface ProductSearchProps {
    onSelect: (product: Product) => void;
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
            .select('*');

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
        handleCloseOverlay();
        // Blur to hide keyboard
        if (typeof window !== 'undefined') {
            (document.activeElement as HTMLElement)?.blur();
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
        <div style={{ width: '100%' }}>
            {/* ── Main Input Trigger ── */}
            <div 
                onClick={handleOpenOverlay}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'rgba(255,255,255,0.06)',
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
