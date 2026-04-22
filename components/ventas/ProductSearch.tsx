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
    const [open, setOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    const search = useCallback(async (q: string, cat: string) => {
        setLoading(true);

        let queryBuilder = supabase
            .from('products')
            .select('*');

        if (cat !== 'Todos') {
            queryBuilder = queryBuilder.eq('categoria', cat);
        }

        if (q.trim().length >= 2) {
            queryBuilder = queryBuilder.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%`);
        }

        const { data, error } = await queryBuilder
            .order('nombre')
            .limit(20);

        if (!error && data) {
            setResults(data);
            setOpen(true);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        const timer = setTimeout(() => search(query, selectedCategory), 300);
        return () => clearTimeout(timer);
    }, [query, selectedCategory, search]);

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
        setQuery('');
        setResults([]);
        setOpen(false);
        setActiveIndex(-1);
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
                    onChange={e => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        setOpen(true);
                        search(query, selectedCategory);
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
                    <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
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
                            {/* Avatar */}
                            {p.image_url || p.imagen ? (
                                <img
                                    src={p.image_url || p.imagen || ''}
                                    style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                                    alt={p.nombre}
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: `${getCategoryColor(p.categoria)}22`,
                                    border: `1px solid ${getCategoryColor(p.categoria)}44`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getCategoryColor(p.categoria) }} />
                                </div>
                            )}
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

            {open && query.length > 0 && results.length === 0 && !loading && (
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
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Sin resultados para "{query}"</div>
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
