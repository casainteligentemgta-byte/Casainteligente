'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RRHHPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)', paddingBottom: '100px' }}>
            {/* ── Header ── */}
            <div className="px-5 pt-14 pb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center text-sm font-medium mb-3 active:opacity-50 transition-opacity"
                            style={{ color: '#007AFF' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mr-1">
                                <path d="M8.5 3.5L4 7l4.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Volver
                        </button>
                        <h1
                            className="font-bold tracking-tight mt-0.5"
                            style={{ fontSize: '34px', color: 'var(--label-primary)', lineHeight: 1.1 }}
                        >
                            Recursos Humanos
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: 'var(--label-secondary)' }}>
                            Gestión de personal, reclutamiento y contratación.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Menu Grid ── */}
            <div className="px-5 grid grid-cols-1 gap-4 mb-6">

                {/* ── Trabajadores (Empleados) ── */}
                <Link
                    href="/rrhh/trabajadores/empleados"
                    className="rounded-2xl p-5 transition-all duration-150 active:scale-95 flex items-center justify-between"
                    style={{
                        background: 'rgba(52,199,89,0.10)',
                        border: '1px solid rgba(52,199,89,0.2)',
                        textDecoration: 'none',
                        boxShadow: '0 4px 20px rgba(52,199,89,0.12)',
                    }}
                >
                    <div>
                        <div className="flex items-center mb-1">
                            <span style={{ fontSize: '24px', marginRight: '8px' }}>💼</span>
                            <h2 className="font-bold" style={{ fontSize: '20px', color: '#34C759', letterSpacing: '-0.02em' }}>
                                Empleados
                            </h2>
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#34C759', opacity: 0.8 }}>
                            Cargos, manuales y evaluaciones
                        </p>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </Link>

                {/* ── Trabajadores (Obreros) ── */}
                <Link
                    href="/rrhh/trabajadores/obreros"
                    className="rounded-2xl p-5 transition-all duration-150 active:scale-95 flex items-center justify-between"
                    style={{
                        background: 'rgba(255,149,0,0.10)',
                        border: '1px solid rgba(255,149,0,0.2)',
                        textDecoration: 'none',
                        boxShadow: '0 4px 20px rgba(255,149,0,0.12)',
                    }}
                >
                    <div>
                        <div className="flex items-center mb-1">
                            <span style={{ fontSize: '24px', marginRight: '8px' }}>👷‍♂️</span>
                            <h2 className="font-bold" style={{ fontSize: '20px', color: '#FF9500', letterSpacing: '-0.02em' }}>
                                Obreros
                            </h2>
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#FF9500', opacity: 0.8 }}>
                            Gaceta oficial y tabulador
                        </p>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </Link>

                {/* ── Reclutamiento ── */}
                <Link
                    href="/rrhh/reclutamiento"
                    className="rounded-2xl p-5 transition-all duration-150 active:scale-95 flex items-center justify-between"
                    style={{
                        background: 'rgba(0,122,255,0.10)',
                        border: '1px solid rgba(0,122,255,0.2)',
                        textDecoration: 'none',
                        boxShadow: '0 4px 20px rgba(0,122,255,0.12)',
                    }}
                >
                    <div>
                        <div className="flex items-center mb-1">
                            <span style={{ fontSize: '24px', marginRight: '8px' }}>🎯</span>
                            <h2 className="font-bold" style={{ fontSize: '20px', color: '#007AFF', letterSpacing: '-0.02em' }}>
                                Reclutamiento
                            </h2>
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#007AFF', opacity: 0.8 }}>
                            Generación de enlaces y QR
                        </p>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </Link>

                {/* ── Contratación ── */}
                <Link
                    href="/rrhh/contratacion"
                    className="rounded-2xl p-5 transition-all duration-150 active:scale-95 flex items-center justify-between"
                    style={{
                        background: 'rgba(88,86,214,0.10)',
                        border: '1px solid rgba(88,86,214,0.2)',
                        textDecoration: 'none',
                        boxShadow: '0 4px 20px rgba(88,86,214,0.12)',
                    }}
                >
                    <div>
                        <div className="flex items-center mb-1">
                            <span style={{ fontSize: '24px', marginRight: '8px' }}>📄</span>
                            <h2 className="font-bold" style={{ fontSize: '20px', color: '#5856D6', letterSpacing: '-0.02em' }}>
                                Contratación
                            </h2>
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#5856D6', opacity: 0.8 }}>
                            Aceptación digital y contratos
                        </p>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5856D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </Link>

            </div>
        </div>
    );
}
