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
        href: '/reclutamiento/dashboard',
        label: 'Talento',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={active ? '#0EA5E9' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" stroke={active ? '#0EA5E9' : '#8E8E93'} strokeWidth="2" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={active ? '#0EA5E9' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

export default function IOSNavBar() {
    const pathname = usePathname();

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 safe-bottom no-print"
            style={{
                background: 'rgba(28, 28, 30, 0.85)',
                backdropFilter: 'blur(25px) saturate(200%)',
                WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                borderTop: '0.5px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: 'env(safe-area-inset-bottom)'
            }}
        >
            <div className="flex items-center justify-around px-2 pt-2 pb-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    const activeColor = item.label === 'Conta' ? '#5856D6' : (item.label === 'Inventario' ? '#FF2D55' : (item.label === 'Productos' ? '#FF9500' : (item.label === 'Ventas' ? '#34C759' : '#007AFF')));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex flex-col items-center gap-1 min-w-[64px] py-1 px-1 transition-all duration-150 active:scale-90"
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
        </nav>
    );
}
