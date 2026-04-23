'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function EmpleadosPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)', paddingBottom: '100px' }}>
            {/* ── Header ── */}
            <div className="px-5 pt-14 pb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <button
                            onClick={() => router.push('/rrhh')}
                            className="flex items-center text-sm font-medium mb-3 active:opacity-50 transition-opacity"
                            style={{ color: '#007AFF' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mr-1">
                                <path d="M8.5 3.5L4 7l4.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Volver a RRHH
                        </button>
                        <h1
                            className="font-bold tracking-tight mt-0.5"
                            style={{ fontSize: '34px', color: 'var(--label-primary)', lineHeight: 1.1 }}
                        >
                            Empleados
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: 'var(--label-secondary)' }}>
                            Gestión de cargos, procedimientos y evaluaciones para el personal administrativo y profesional.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Menu Grid ── */}
            <div className="px-5 grid grid-cols-1 gap-4 mb-6">

                {/* ── Lista de Empleos / Cargos ── */}
                <Link
                    href="/rrhh/trabajadores/empleados/cargos"
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
                            <span style={{ fontSize: '24px', marginRight: '8px' }}>📋</span>
                            <h2 className="font-bold" style={{ fontSize: '20px', color: '#34C759', letterSpacing: '-0.02em' }}>
                                Lista de Cargos
                            </h2>
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#34C759', opacity: 0.8 }}>
                            Perfiles y descripción de puestos
                        </p>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </Link>

                {/* ── Manuales de Procedimientos ── */}
                <Link
                    href="/rrhh/trabajadores/empleados/manuales"
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
                            <span style={{ fontSize: '24px', marginRight: '8px' }}>📘</span>
                            <h2 className="font-bold" style={{ fontSize: '20px', color: '#007AFF', letterSpacing: '-0.02em' }}>
                                Manuales
                            </h2>
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#007AFF', opacity: 0.8 }}>
                            Procedimientos por cada cargo
                        </p>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </Link>

                {/* ── Evaluaciones y Tests ── */}
                <Link
                    href="/rrhh/trabajadores/empleados/evaluaciones"
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
                            <span style={{ fontSize: '24px', marginRight: '8px' }}>📝</span>
                            <h2 className="font-bold" style={{ fontSize: '20px', color: '#FF9500', letterSpacing: '-0.02em' }}>
                                Evaluaciones
                            </h2>
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#FF9500', opacity: 0.8 }}>
                            Tests y cuestionarios de aptitud
                        </p>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </Link>

            </div>
        </div>
    );
}
