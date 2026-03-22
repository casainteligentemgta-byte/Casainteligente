'use client';
// v2 — navbar with Empleados + panel Más
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

// ── Ítems principales (siempre visibles en la barra) ──────────
const mainItems = [
    {
        href: '/',
        label: 'Inicio',
        color: '#007AFF',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={active ? 'rgba(0,122,255,0.1)' : 'none'} />
                <path d="M9 22V12h6v10" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        href: '/clientes',
        label: 'Clientes',
        color: '#007AFF',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="2" />
            </svg>
        ),
    },
    {
        href: '/ventas',
        label: 'Ventas',
        color: '#34C759',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="7" width="20" height="14" rx="2" stroke={active ? '#34C759' : '#8E8E93'} strokeWidth="2" fill={active ? 'rgba(52,199,89,0.1)' : 'none'} />
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" stroke={active ? '#34C759' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        href: '/empleados',
        label: 'Empleados',
        color: '#FFD60A',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={active ? '#FFD60A' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" stroke={active ? '#FFD60A' : '#8E8E93'} strokeWidth="2" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={active ? '#FFD60A' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
];

// ── Ítems secundarios (en el panel "Más") ─────────────────────
const moreItems = [
    { href: '/presupuestos', label: 'Presupuestos', emoji: '📄', color: '#007AFF' },
    { href: '/productos',    label: 'Productos',    emoji: '📦', color: '#FF9500' },
    { href: '/almacen',      label: 'Inventario',   emoji: '🏭', color: '#FF2D55' },
    { href: '/contabilidad', label: 'Contabilidad', emoji: '💰', color: '#5856D6' },
    { href: '/personas',     label: 'Personas',     emoji: '👤', color: '#30D158' },
    { href: '/nexus',        label: 'Nexus',        emoji: '🔮', color: '#BF5AF2' },
];

export default function IOSNavBar() {
    const pathname = usePathname();
    const [showMore, setShowMore] = useState(false);

    const isMoreActive = moreItems.some(item => pathname.startsWith(item.href));

    return (
        <>
            {/* ── Panel "Más" ── */}
            {showMore && (
                <div
                    onClick={() => setShowMore(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            position: 'absolute', bottom: '80px', left: '12px', right: '12px',
                            background: 'rgba(28,28,30,0.97)', borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.1)', padding: '16px',
                            backdropFilter: 'blur(40px)',
                        }}
                    >
                        <p style={{ margin: '0 0 14px 0', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '4px' }}>
                            Módulos
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            {moreItems.map(item => {
                                const active = pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setShowMore(false)}
                                        style={{ textDecoration: 'none' }}
                                    >
                                        <div style={{
                                            padding: '14px 8px', borderRadius: '14px', textAlign: 'center',
                                            background: active ? `${item.color}18` : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${active ? item.color + '40' : 'rgba(255,255,255,0.08)'}`,
                                            transition: 'all 0.15s',
                                        }}>
                                            <div style={{ fontSize: '24px', marginBottom: '6px' }}>{item.emoji}</div>
                                            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: active ? item.color : 'rgba(255,255,255,0.6)' }}>
                                                {item.label}
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Barra inferior ── */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-50 safe-bottom no-print"
                style={{
                    background: 'rgba(28, 28, 30, 0.92)',
                    backdropFilter: 'blur(25px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                    borderTop: '0.5px solid rgba(255, 255, 255, 0.1)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                }}
            >
                <div className="flex items-center justify-around px-2 pt-2 pb-2">
                    {/* Main items */}
                    {mainItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex flex-col items-center gap-1 min-w-[56px] py-1 px-1 transition-all duration-150 active:scale-90"
                                style={{ WebkitTapHighlightColor: 'transparent', textDecoration: 'none' }}
                            >
                                <div className="transition-transform duration-150">
                                    {item.icon(isActive)}
                                </div>
                                <span className="text-[10px] font-semibold tracking-tight" style={{ color: isActive ? item.color : '#8E8E93' }}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* Más button */}
                    <button
                        onClick={() => setShowMore(v => !v)}
                        className="flex flex-col items-center gap-1 min-w-[56px] py-1 px-1 transition-all duration-150 active:scale-90"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <circle cx="5"  cy="12" r="2" fill={showMore || isMoreActive ? '#FF9500' : '#8E8E93'} />
                            <circle cx="12" cy="12" r="2" fill={showMore || isMoreActive ? '#FF9500' : '#8E8E93'} />
                            <circle cx="19" cy="12" r="2" fill={showMore || isMoreActive ? '#FF9500' : '#8E8E93'} />
                        </svg>
                        <span className="text-[10px] font-semibold tracking-tight" style={{ color: showMore || isMoreActive ? '#FF9500' : '#8E8E93' }}>
                            Más
                        </span>
                    </button>
                </div>
            </nav>
        </>
    );
}
