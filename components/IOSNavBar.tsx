'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    {
        href: '/',
        label: 'Inicio',
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
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        href: '/presupuestos',
        label: 'Presupuestos',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={active ? 'rgba(0,122,255,0.1)' : 'none'} />
            </svg>
        ),
    },
    {
        href: '/ventas',
        label: 'Ventas',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="7" width="20" height="14" rx="2" stroke={active ? '#34C759' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={active ? 'rgba(52,199,89,0.1)' : 'none'} />
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" stroke={active ? '#34C759' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        href: '/productos',
        label: 'Productos',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={active ? '#FF9500' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={active ? 'rgba(255,149,0,0.1)' : 'none'} />
            </svg>
        ),
    },
    {
        href: '/proyectos/modulo',
        label: 'Proyectos',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke={active ? '#F59E0B' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={active ? 'rgba(245,158,11,0.12)' : 'none'} />
            </svg>
        ),
    },
    {
        href: '/configuracion/entidades',
        label: 'Entidades',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 21h16M6 21V8l6-3 6 3v13M9 21v-5h6v5" stroke={active ? '#A78BFA' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={active ? 'rgba(167,139,250,0.15)' : 'none'} />
                <path d="M12 5v3" stroke={active ? '#A78BFA' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        href: '/rrhh/hojas-vida',
        label: 'RRHH',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h6m-6 4h6m-6-8h6"
                    stroke={active ? '#F472B6' : '#8E8E93'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        ),
    },
    {
        href: '/talento',
        label: 'Talento+',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke={active ? '#38BDF8' : '#8E8E93'} strokeWidth="2" strokeLinejoin="round" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke={active ? '#38BDF8' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        href: '/almacen',
        label: 'Inventario',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke={active ? '#FF2D55' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={active ? 'rgba(255,45,85,0.1)' : 'none'} />
            </svg>
        ),
    },
    {
        href: '/contabilidad',
        label: 'Conta',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke={active ? '#5856D6' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
];

function navItemActive(pathname: string, href: string): boolean {
    if (pathname === href) return true;
    if (href === '/') return false;
    if (href === '/rrhh/hojas-vida') return pathname.startsWith('/rrhh');
    if (href === '/configuracion/entidades') {
        return pathname.startsWith('/configuracion/entidades') || pathname.startsWith('/entidades');
    }
    return pathname.startsWith(href);
}

export default function IOSNavBar() {
    const pathname = usePathname();
    const path =
        (typeof pathname === 'string' && pathname.length > 0 ? pathname : null) ??
        (typeof window !== 'undefined' ? window.location.pathname : '');
    /** Postulación pública: no mostrar «Inicio» (primer ítem del dock). */
    const items = path.startsWith('/registro') ? navItems.filter((i) => i.href !== '/') : navItems;

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 safe-bottom no-print mx-auto max-w-lg px-2 pb-1 sm:max-w-3xl"
            style={{
                background: 'rgba(22, 22, 24, 0.82)',
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                borderRadius: '18px 18px 0 0',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderBottom: 'none',
                boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.35)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="overflow-x-auto scrollbar-hide">
                <div className="flex min-w-max items-center gap-0.5 px-1 pb-1.5 pt-2">
                {items.map((item) => {
                    const isActive = navItemActive(path || pathname || '', item.href);
                    const activeColor =
                        item.label === 'Conta'
                            ? '#5856D6'
                            : item.label === 'Inventario'
                                ? '#FF2D55'
                                : item.label === 'Productos'
                                    ? '#FF9500'
                                    : item.label === 'Proyectos'
                                        ? '#F59E0B'
                                        : item.label === 'Entidades'
                                            ? '#A78BFA'
                                            : item.label === 'RRHH'
                                              ? '#F472B6'
                                              : item.label === 'Talento+'
                                                ? '#38BDF8'
                                                : item.label === 'Ventas'
                                                  ? '#34C759'
                                                  : '#007AFF';

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex flex-col items-center gap-1 min-w-[62px] py-1 px-1 transition-all duration-150 active:scale-90"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                            <div className="transition-transform duration-150">
                                {item.icon(isActive)}
                            </div>
                            <span
                                className="text-[10px] font-semibold tracking-tight"
                                style={{ color: isActive ? activeColor : '#8E8E93' }}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
                </div>
            </div>
        </nav>
    );
}
