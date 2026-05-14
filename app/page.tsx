'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GlassCardMotion } from '@/components/nexus/GlassCard';
import { motion } from 'framer-motion';

export default function DashboardPage() {
    const [productCount, setProductCount] = useState<number | null>(null);
    const [clientCount, setClientCount] = useState<number | null>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.from('products').select('id', { count: 'exact', head: true })
            .then(({ count }) => setProductCount(count ?? 0));
        supabase.from('customers').select('id', { count: 'exact', head: true })
            .then(({ count }) => setClientCount(count ?? 0));
    }, []);

    const now = new Date();
    const dayName = now.toLocaleDateString('es-VE', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
    const dayLabel = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dateStr}`;

    return (
        <div className="min-h-screen pb-28">

            {/* ── Header ── */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-6 pt-16 pb-8"
            >
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--nexus-text-dim)]">
                            {dayLabel}
                        </p>
                        <h1 className="text-4xl font-bold tracking-tight text-white">
                            Dashboard
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/nexus"
                            className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-tighter text-[var(--nexus-cyan)] ring-1 ring-[rgba(0,242,254,0.3)] hover:bg-[rgba(0,242,254,0.1)] transition-all"
                        >
                            Nexus
                        </Link>
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--ios-blue)] to-[var(--ios-indigo)] flex items-center justify-center text-white font-bold shadow-[0_4px_12px_rgba(0,122,255,0.3)] border border-white/20">
                            CI
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── Stats Grid ── */}
            <div className="px-6 grid grid-cols-2 gap-4">

                {/* ── Clientes ── */}
                <div className="relative group">
                    <Link href="/clientes" className="block h-full">
                        <GlassCardMotion 
                            delay={0.1}
                            className="h-full !bg-blue-500/5 border-blue-500/20 active:scale-95 transition-transform"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <span className="text-2xl">👥</span>
                                <div className="w-7 h-7" />
                            </div>
                            <p className="text-3xl font-bold tracking-tighter text-[var(--ios-blue)]">
                                {clientCount ?? '—'}
                            </p>
                            <p className="text-xs font-bold uppercase tracking-widest text-[var(--ios-blue)] opacity-60 mt-1">
                                Clientes
                            </p>
                        </GlassCardMotion>
                    </Link>
                    <Link
                        href="/clientes/nuevo"
                        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-[var(--ios-blue)] flex items-center justify-center shadow-[0_4px_12px_rgba(0,122,255,0.4)] hover:scale-110 active:scale-90 transition-all"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                    </Link>
                </div>

                {/* ── Ventas ── */}
                <GlassCardMotion 
                    delay={0.2}
                    className="!bg-green-500/5 border-green-500/20"
                >
                    <div className="flex items-start justify-between mb-4">
                        <span className="text-2xl">📈</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-[var(--ios-green)] uppercase">
                            +8.3%
                        </span>
                    </div>
                    <p className="text-3xl font-bold tracking-tighter text-white">
                        $48.2K
                    </p>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--nexus-text-muted)] mt-1">
                        Ventas
                    </p>
                </GlassCardMotion>

                {/* ── Proyectos ── */}
                <GlassCardMotion 
                    delay={0.3}
                    className="!bg-orange-500/5 border-orange-500/20"
                >
                    <div className="flex items-start justify-between mb-4">
                        <span className="text-2xl">🏗️</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-[var(--ios-orange)] uppercase">
                            +3
                        </span>
                    </div>
                    <p className="text-3xl font-bold tracking-tighter text-white">
                        18
                    </p>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--nexus-text-muted)] mt-1">
                        Proyectos
                    </p>
                </GlassCardMotion>

                {/* ── Productos ── */}
                <div className="relative group">
                    <Link href="/productos" className="block h-full">
                        <GlassCardMotion 
                            delay={0.4}
                            className="h-full !bg-orange-500/5 border-orange-500/20 active:scale-95 transition-transform"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <span className="text-2xl">📦</span>
                                <div className="w-7 h-7" />
                            </div>
                            <p className="text-3xl font-bold tracking-tighter text-[var(--ios-orange)]">
                                {productCount ?? '—'}
                            </p>
                            <p className="text-xs font-bold uppercase tracking-widest text-[var(--ios-orange)] opacity-60 mt-1">
                                Productos
                            </p>
                        </GlassCardMotion>
                    </Link>
                    <Link
                        href="/productos/nuevo"
                        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-[var(--ios-orange)] flex items-center justify-center shadow-[0_4px_12px_rgba(255,149,0,0.4)] hover:scale-110 active:scale-90 transition-all"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                    </Link>
                </div>

            </div>
        </div>
    );
}
