'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Customer {
    id: string;
    nombre: string;
    rif: string | null;
    movil: string | null;
    email: string | null;
}

interface ClientSearchProps {
    value: string;
    onChange: (val: string) => void;
    onSelect: (customer: Customer) => void;
    placeholder?: string;
}

export default function ClientSearch({ value, onChange, onSelect, placeholder }: ClientSearchProps) {
    const [results, setResults] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    const search = useCallback(async (q: string) => {
        setLoading(true);

        let queryBuilder = supabase
            .from('customers')
            .select('*');

        if (q.trim()) {
            queryBuilder = queryBuilder.or(`nombre.ilike.%${q}%,rif.ilike.%${q}%`);
        }

        const { data, error } = await queryBuilder
            .order('nombre')
            .limit(20);

        if (!error && data) {
            setResults(data);
        } else {
            setResults([]);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (open) search(value);
        }, 300);
        return () => clearTimeout(timer);
    }, [value, search, open]);

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

    const handleSelect = (customer: Customer) => {
        onSelect(customer);
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
        } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
            e.preventDefault();
            handleSelect(results[activeIndex]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <div 
                onClick={() => {
                    setOpen(true);
                    search(value);
                }}
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    cursor: 'pointer',
                    width: '100%'
                }}
            >
                <input
                    ref={inputRef}
                    readOnly
                    type="text"
                    value={value}
                    placeholder={placeholder || 'Nombre del cliente o empresa...'}
                    style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit', fontWeight: 500,
                        cursor: 'pointer'
                    }}
                />
                <div
                    style={{
                        background: 'none', border: 'none', padding: '4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'rgba(255,255,255,0.3)', transition: 'transform 0.2s',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>

            {open && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 2000,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                    }}
                    onClick={() => setOpen(false)}
                >
                    <div
                        ref={dropdownRef}
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '500px',
                            maxHeight: '80vh',
                            background: 'rgba(28,28,30,0.98)',
                            backdropFilter: 'blur(40px)',
                            WebkitBackdropFilter: 'blur(40px)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '24px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 30px 90px rgba(0,0,0,0.7)',
                            animation: 'modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '10px',
                                    background: 'rgba(0,122,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <circle cx="9" cy="7" r="4" stroke="#007AFF" strokeWidth="2" />
                                        <path d="M2 21c0-4 3-7 7-7s7 3 7 7" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </div>
                                <span style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>Seleccionar Cliente</span>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: 'white' }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>

                        {/* Search Input in Modal */}
                        <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px', padding: '10px 14px'
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round">
                                    <circle cx="11" cy="11" r="7" />
                                    <path d="M21 21l-4.35-4.35" />
                                </svg>
                                <input
                                    autoFocus
                                    type="text"
                                    value={value}
                                    onChange={e => onChange(e.target.value)}
                                    placeholder="Buscar por nombre o RIF..."
                                    style={{
                                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                        color: 'white', fontSize: '15px', fontFamily: 'inherit'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Results list */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {loading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                                    Buscando clientes...
                                </div>
                            ) : results.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No se encontraron resultados</p>
                                </div>
                            ) : (
                                results.map((c, i) => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleSelect(c)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            width: '100%', padding: '14px 20px',
                                            background: i === activeIndex ? 'rgba(0,122,255,0.12)' : 'transparent',
                                            border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={() => setActiveIndex(i)}
                                    >
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '12px',
                                            background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            <span style={{ color: '#34C759', fontWeight: 800, fontSize: '14px' }}>{c.nombre[0].toUpperCase()}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: 'white', fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {c.nombre}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                                                {c.rif && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{c.rif}</span>}
                                                {c.movil && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>· {c.movil}</span>}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes modalSlideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
