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
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={e => {
                    onChange(e.target.value);
                    setOpen(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    setOpen(true);
                    search(value);
                }}
                placeholder={placeholder || 'Nombre del cliente o empresa...'}
                style={{
                    width: '100%', background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit', fontWeight: 500,
                }}
            />

            {open && results.length > 0 && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 12px)',
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
                        maxHeight: '300px',
                        overflowY: 'auto',
                    }}
                >
                    <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                            {loading ? 'Buscando...' : `${results.length} resultado${results.length !== 1 ? 's' : ''}`}
                        </span>
                    </div>
                    {results.map((c, i) => (
                        <button
                            key={c.id}
                            onClick={() => handleSelect(c)}
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
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                background: 'rgba(52,199,89,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#34C759" strokeWidth="2" strokeLinecap="round" />
                                    <circle cx="12" cy="7" r="4" stroke="#34C759" strokeWidth="2" />
                                </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: 'white', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {c.nombre}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                    {c.rif && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{c.rif}</span>}
                                    {c.movil && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>· {c.movil}</span>}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
