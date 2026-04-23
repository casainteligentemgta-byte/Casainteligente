'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Datos de ejemplo
const tabuladores = [
    { id: 1, categoria: 'Especializado', salarioSemanal: '$120.00', bonos: '$30.00' },
    { id: 2, categoria: 'Primera', salarioSemanal: '$90.00', bonos: '$20.00' },
    { id: 3, categoria: 'Segunda', salarioSemanal: '$70.00', bonos: '$15.00' },
];

export default function TabuladorPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)', paddingBottom: '100px' }}>
            {/* Header */}
            <div className="px-5 pt-14 pb-4">
                <button
                    onClick={() => router.push('/rrhh/trabajadores/obreros')}
                    className="flex items-center text-sm font-medium mb-3 active:opacity-50 transition-opacity"
                    style={{ color: '#007AFF' }}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mr-1">
                        <path d="M8.5 3.5L4 7l4.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Volver a Obreros
                </button>
                <div className="flex items-center justify-between">
                    <h1 className="font-bold tracking-tight leading-tight" style={{ fontSize: '32px', color: 'var(--label-primary)' }}>
                        Tabulador Salarial
                    </h1>
                </div>
                <p className="mt-1 text-sm mb-4" style={{ color: 'var(--label-secondary)' }}>
                    Escala salarial basada en las convenciones vigentes.
                </p>
            </div>

            {/* List */}
            <div className="px-5">
                <div className="flex flex-col gap-3">
                    {tabuladores.map((tab) => (
                        <div
                            key={tab.id}
                            className="p-5 rounded-2xl flex flex-col justify-between"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                            }}
                        >
                            <h3 className="font-bold leading-tight mb-4" style={{ fontSize: '20px', color: '#007AFF' }}>
                                Categoría: {tab.categoria}
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--label-tertiary)' }}>Salario Base Semanal</p>
                                    <p className="font-bold" style={{ fontSize: '24px', color: 'var(--label-primary)' }}>{tab.salarioSemanal}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--label-tertiary)' }}>Bonos / Otros</p>
                                    <p className="font-bold" style={{ fontSize: '24px', color: 'var(--label-primary)' }}>{tab.bonos}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {tabuladores.length === 0 && (
                        <div className="text-center py-8" style={{ color: 'var(--label-tertiary)' }}>
                            No hay información de tabulador disponible.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
