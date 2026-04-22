'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
    const [productCount, setProductCount] = useState<number | null>(null);
    const [clientCount, setClientCount] = useState<number | null>(null);
    const [projectCount, setProjectCount] = useState<number | null>(null);

    useEffect(() => {
        const supabase = createClient();
        // Contar productos
        supabase.from('products').select('id', { count: 'exact', head: true })
            .then(({ count }) => setProductCount(count ?? 0));
        // Contar clientes
        supabase.from('customers').select('id', { count: 'exact', head: true })
            .then(({ count }) => setClientCount(count ?? 0));
        // Contar proyectos
        supabase.from('ci_proyectos').select('id', { count: 'exact', head: true })
            .then(({ count }) => setProjectCount(count ?? 0));
    }, []);

    const now = new Date();
    const dayName = now.toLocaleDateString('es-VE', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
    const dayLabel = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dateStr}`;

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)', paddingBottom: '100px' }}>

            {/* ── Header ── */}
            <div className="px-5 pt-14 pb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="font-medium" style={{ fontSize: '15px', color: 'var(--label-tertiary)' }}>
                            {dayLabel}
                        </p>
                        <h1
                            className="font-bold tracking-tight mt-0.5"
                            style={{ fontSize: '34px', color: 'var(--label-primary)', lineHeight: 1.1 }}
                        >
                            Dashboard
                        </h1>
                    </div>
                    <div
                        className="flex items-center justify-center rounded-full font-bold text-white"
                        style={{
                            width: '44px', height: '44px',
                            background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                            fontSize: '16px',
                            boxShadow: '0 4px 12px rgba(0,122,255,0.35)',
                            flexShrink: 0,
                        }}
                    >
                        CI
                    </div>
                </div>
            </div>

            {/* ── Stats Grid ── */}
            <div className="px-5 grid grid-cols-2 gap-3 mb-6">

                {/* ── Clientes ── */}
                <div style={{ position: 'relative' }}>
                    <Link
                        href="/clientes"
                        className="rounded-2xl p-4 transition-all duration-150 active:scale-95"
                        style={{
                            background: 'rgba(0,122,255,0.10)',
                            border: '1px solid rgba(0,122,255,0.2)',
                            textDecoration: 'none', display: 'block',
                            boxShadow: '0 4px 20px rgba(0,122,255,0.12)',
                        }}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <span style={{ fontSize: '24px' }}>👥</span>
                            <div style={{ width: '28px', height: '28px' }} />
                        </div>
                        <p className="font-bold" style={{ fontSize: '26px', color: '#007AFF', letterSpacing: '-0.03em' }}>
                            {clientCount ?? '—'}
                        </p>
                        <p className="text-sm font-medium mt-0.5" style={{ color: '#007AFF', opacity: 0.7 }}>
                            Clientes
                        </p>
                    </Link>
                    <Link
                        href="/clientes/nuevo"
                        style={{
                            position: 'absolute', top: '16px', right: '16px', zIndex: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '8px',
                            background: '#007AFF', boxShadow: '0 2px 8px rgba(0,122,255,0.4)',
                            textDecoration: 'none',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </Link>
                </div>

                {/* ── Ventas ── */}
                <div
                    className="rounded-2xl p-4"
                    style={{
                        background: 'rgba(52,199,89,0.08)',
                        border: '1px solid rgba(52,199,89,0.15)',
                        boxShadow: '0 4px 20px rgba(52,199,89,0.08)',
                    }}
                >
                    <div className="flex items-start justify-between mb-3">
                        <span style={{ fontSize: '24px' }}>📈</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(52,199,89,0.15)', color: '#34C759' }}>
                            +8.3%
                        </span>
                    </div>
                    <p className="font-bold" style={{ fontSize: '26px', color: 'var(--label-primary)', letterSpacing: '-0.03em' }}>
                        $48.2K
                    </p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--label-secondary)' }}>
                        Ventas
                    </p>
                </div>

                {/* ── Proyectos ── */}
                <div style={{ position: 'relative' }}>
                    <Link
                        href="/operaciones/proyectos"
                        className="rounded-2xl p-4 transition-all duration-150 active:scale-95"
                        style={{
                            background: 'rgba(90,200,250,0.10)',
                            border: '1px solid rgba(90,200,250,0.2)',
                            textDecoration: 'none', display: 'block',
                            boxShadow: '0 4px 20px rgba(90,200,250,0.12)',
                        }}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <span style={{ fontSize: '24px' }}>🏗️</span>
                            <div style={{ width: '28px', height: '28px' }} />
                        </div>
                        <p className="font-bold" style={{ fontSize: '26px', color: '#5AC8FA', letterSpacing: '-0.03em' }}>
                            {projectCount ?? '—'}
                        </p>
                        <p className="text-sm font-medium mt-0.5" style={{ color: '#5AC8FA', opacity: 0.7 }}>
                            Proyectos
                        </p>
                    </Link>
                </div>

                {/* ── Productos ── */}
                <div style={{ position: 'relative' }}>
                    <Link
                        href="/productos"
                        className="rounded-2xl p-4 transition-all duration-150 active:scale-95"
                        style={{
                            background: 'rgba(255,149,0,0.10)',
                            border: '1px solid rgba(255,149,0,0.2)',
                            textDecoration: 'none', display: 'block',
                            boxShadow: '0 4px 20px rgba(255,149,0,0.12)',
                        }}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <span style={{ fontSize: '24px' }}>📦</span>
                            <div style={{ width: '28px', height: '28px' }} />
                        </div>
                        <p className="font-bold" style={{ fontSize: '26px', color: '#FF9500', letterSpacing: '-0.03em' }}>
                            {productCount ?? '—'}
                        </p>
                        <p className="text-sm font-medium mt-0.5" style={{ color: '#FF9500', opacity: 0.7 }}>
                            Productos
                        </p>
                    </Link>
                    <Link
                        href="/productos/nuevo"
                        style={{
                            position: 'absolute', top: '16px', right: '16px', zIndex: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '8px',
                            background: '#FF9500', boxShadow: '0 2px 8px rgba(255,149,0,0.4)',
                            textDecoration: 'none',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </Link>
                </div>

            </div>
        </div>
    );
}
