'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import ClienteCard from '@/components/clientes/ClienteCard';
import { createClient } from '@/lib/supabase/client';

// En clientes solo mostramos clasificación por tipo:
// - Personas naturales
// - Personas jurídicas (empresas)
const FILTERS = ['Personas', 'Empresas'];

type ClienteTipoCard = 'V' | 'J' | 'E';
type ClienteStatusCard = 'activo' | 'inactivo' | 'pendiente';

function colorPorId(id: string): string {
    const paleta = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500', '#00C7BE', '#34C759'];
    let h = 0;
    for (let i = 0; i < id.length; i++) h += id.charCodeAt(i);
    return paleta[h % paleta.length];
}

/** La tabla `customers.tipo` puede ser "empresa" o letra RIF; ClienteCard espera V | J | E */
function normalizarTipo(tipoRaw: string | null | undefined, categoria: 'personal' | 'empresa'): ClienteTipoCard {
    const t = (tipoRaw || '').trim().toUpperCase();
    if (t === 'V' || t === 'J' || t === 'E') return t;
    if (categoria === 'empresa') return 'J';
    return 'V';
}

function normalizarStatus(s: string | null | undefined): ClienteStatusCard {
    const v = (s || 'activo').toLowerCase();
    if (v === 'inactivo' || v === 'pendiente' || v === 'activo') return v;
    return 'activo';
}

export default function ClientesPage() {
    const [search, setSearch] = useState('');
    const [filtro, setFiltro] = useState('Personas');
    const [lista, setLista] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchClientes = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        const supabase = createClient();
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            setFetchError(error.message);
            setLista([]);
            setLoading(false);
            return;
        }

        if (data) {
            const mapped = data.map((c: Record<string, unknown>) => {
                const nombreSafe = (typeof c.nombre === 'string' && c.nombre.trim()) ? c.nombre.trim() : 'Sin nombre';
                const partes = nombreSafe.split(/\s+/).filter(Boolean);
                const initials =
                    partes.map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                const tipoStr = typeof c.tipo === 'string' ? c.tipo : '';
                const categoria = tipoStr.toLowerCase() === 'empresa' ? 'empresa' : 'personal';
                const tipoLetra = normalizarTipo(tipoStr, categoria);
                const idStr = String(c.id ?? '');

                return {
                    ...c,
                    nombre: nombreSafe,
                    rif: typeof c.rif === 'string' ? c.rif : '',
                    email: typeof c.email === 'string' ? c.email : '',
                    tipo: tipoLetra,
                    categoria,
                    status: normalizarStatus(typeof c.status === 'string' ? c.status : undefined),
                    telefono: typeof c.movil === 'string' ? c.movil : '',
                    movil: typeof c.movil === 'string' ? c.movil : undefined,
                    direccion: typeof c.direccion === 'string' ? c.direccion : '',
                    imagen: c.imagen || null,
                    initials,
                    color: colorPorId(idStr),
                };
            });
            setLista(mapped);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes]);

    const filtered = lista.filter(c => {
        const nombreLc = (c.nombre || '').toLowerCase();
        const matchSearch = search.trim() === '' ||
            nombreLc.includes(search.toLowerCase()) ||
            (c.rif && String(c.rif).toLowerCase().includes(search.toLowerCase())) ||
            (c.email && String(c.email).toLowerCase().includes(search.toLowerCase())) ||
            (c.movil && String(c.movil).includes(search));

        const matchFiltro =
            filtro === 'Personas' ? c.categoria === 'personal' : c.categoria === 'empresa';

        return matchSearch && matchFiltro;
    });

    const personasCount = lista.filter(c => c.categoria === 'personal').length;
    const empresasCount = lista.filter(c => c.categoria === 'empresa').length;

    const handleDelete = async (id: string) => {
        const supabase = createClient();
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (!error) {
            setLista(prev => prev.filter(c => c.id !== id));
        } else {
            alert('Error al borrar: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 20px', paddingBottom: '100px' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: '15px' }}>Cargando clientes…</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px 20px 100px' }}>
                <div style={{
                    maxWidth: '480px', margin: '0 auto', padding: '20px', borderRadius: '16px',
                    background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.35)', color: 'white',
                }}>
                    <p style={{ fontWeight: 700, marginBottom: '8px' }}>No se pudo cargar clientes</p>
                    <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px' }}>{fetchError}</p>
                    <p style={{ fontSize: '13px', opacity: 0.75, lineHeight: 1.5 }}>
                        Revisa que exista la tabla <code style={{ color: '#FF9500' }}>customers</code> en Supabase y que{' '}
                        <code style={{ color: '#FF9500' }}>.env.local</code> tenga URL y anon key correctos.
                    </p>
                    <button
                        type="button"
                        onClick={() => fetchClientes()}
                        style={{
                            marginTop: '16px', padding: '10px 18px', borderRadius: '12px', border: 'none',
                            background: '#007AFF', color: 'white', fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '100px' }}>

            {/* ── Header sticky ── */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '16px 20px 14px',
            }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '11px',
                            background: 'rgba(0,122,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <circle cx="9" cy="7" r="4" stroke="#007AFF" strokeWidth="1.8" />
                                <path d="M2 21c0-4 3.1-7 7-7s7 3 7 7" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" />
                                <path d="M19 8v6M22 11h-6" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div>
                            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'white', lineHeight: 1 }}>Clientes</h1>
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                                {filtered.length} de {lista.length} registros
                                {' · '}
                                {filtro}
                                {search ? ` · "${search}"` : ''}
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/clientes/nuevo"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.4)',
                            textDecoration: 'none', flexShrink: 0,
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 2v12M2 8h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </Link>
                </div>

                {/* Search */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: 'rgba(255,255,255,0.09)',
                    border: `1px solid ${search ? 'rgba(0,122,255,0.5)' : 'rgba(255,255,255,0.13)'}`,
                    borderRadius: '13px', padding: '10px 14px',
                    transition: 'border-color 0.2s',
                    boxShadow: search ? '0 0 0 3px rgba(0,122,255,0.08)' : 'none',
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="7" stroke={search ? '#007AFF' : 'rgba(255,255,255,0.4)'} strokeWidth="2" />
                        <path d="M16.5 16.5L21 21" stroke={search ? '#007AFF' : 'rgba(255,255,255,0.4)'} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, RIF, email..."
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'white', fontSize: '15px', fontFamily: 'inherit',
                        }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.15)" />
                                <path d="M8 8l8 8M16 8l-8 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Filter chips */}
                <div style={{ overflowX: 'auto', marginTop: '12px', paddingBottom: '2px' }}>
                    <div style={{ display: 'flex', gap: '7px', width: 'max-content' }}>
                        {FILTERS.map(f => {
                            const active = filtro === f;
                            return (
                                <button
                                    key={f}
                                    onClick={() => setFiltro(f)}
                                    style={{
                                        padding: '6px 13px', borderRadius: '20px', whiteSpace: 'nowrap',
                                        border: active ? '1.5px solid #007AFF' : '1px solid rgba(255,255,255,0.1)',
                                        background: active ? 'rgba(0,122,255,0.18)' : 'rgba(255,255,255,0.05)',
                                        color: active ? '#007AFF' : 'rgba(255,255,255,0.45)',
                                        fontSize: '12px', fontWeight: active ? 700 : 500,
                                        cursor: 'pointer', fontFamily: 'inherit',
                                        transition: 'all 0.18s',
                                        boxShadow: active ? '0 0 0 3px rgba(0,122,255,0.1)' : 'none',
                                    }}
                                >
                                    {f}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '16px 16px 8px' }}>
                {[
                    { label: 'Total', value: lista.length, color: '#007AFF', bg: 'rgba(0,122,255,0.08)', border: 'rgba(0,122,255,0.15)' },
                    { label: 'Empresas', value: empresasCount, color: '#FF9500', bg: 'rgba(255,149,0,0.08)', border: 'rgba(255,149,0,0.15)' },
                    { label: 'Personas', value: personasCount, color: '#34C759', bg: 'rgba(52,199,89,0.08)', border: 'rgba(52,199,89,0.15)' },
                ].map(s => (
                    <div key={s.label} style={{
                        background: s.bg, border: `1px solid ${s.border}`,
                        borderRadius: '16px', padding: '12px', textAlign: 'center',
                    }}>
                        <p style={{ fontSize: '22px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', fontWeight: 500 }}>{s.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Client list ── */}
            <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', fontWeight: 600 }}>Sin resultados</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginTop: '4px' }}>
                            Prueba con otro término o filtro
                        </p>
                                {(search || filtro !== 'Personas') && (
                            <button
                                        onClick={() => { setSearch(''); setFiltro('Personas'); }}
                                style={{
                                    marginTop: '16px', padding: '10px 20px', borderRadius: '12px',
                                    background: 'rgba(0,122,255,0.15)', border: '1px solid rgba(0,122,255,0.3)',
                                    color: '#007AFF', fontSize: '14px', fontWeight: 600,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                }}
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    filtered.map(cliente => (
                        <ClienteCard
                            key={cliente.id}
                            cliente={cliente}
                            onDelete={handleDelete}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
