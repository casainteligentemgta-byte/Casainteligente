'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Datos de ejemplo
const manuales = [
    { id: 1, cargo: 'Vendedor', titulo: 'Manual de Ventas B2B', revision: '12 Feb 2026', docUrl: '#' },
    { id: 2, cargo: 'Asesor Técnico', titulo: 'Protocolo de Soporte Nivel 1', revision: '05 Ene 2026', docUrl: '#' },
    { id: 3, cargo: 'Gerente General', titulo: 'Manual Operativo de Dirección', revision: '22 Nov 2025', docUrl: '#' },
];

export default function ManualesPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredManuales = manuales.filter(m => 
        m.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.cargo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)', paddingBottom: '100px' }}>
            {/* Header */}
            <div className="px-5 pt-14 pb-4">
                <button
                    onClick={() => router.push('/rrhh/trabajadores/empleados')}
                    className="flex items-center text-sm font-medium mb-3 active:opacity-50 transition-opacity"
                    style={{ color: '#007AFF' }}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mr-1">
                        <path d="M8.5 3.5L4 7l4.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Volver a Empleados
                </button>
                <div className="flex items-center justify-between">
                    <h1 className="font-bold tracking-tight" style={{ fontSize: '32px', color: 'var(--label-primary)' }}>
                        Manuales
                    </h1>
                </div>
                <p className="mt-1 text-sm mb-4" style={{ color: 'var(--label-secondary)' }}>
                    Procedimientos y guías operativas por cargo.
                </p>

                {/* Buscador */}
                <div className="relative">
                    <svg className="absolute left-3 top-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--label-tertiary)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        placeholder="Buscar por manual o cargo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl outline-none"
                        style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--label-primary)',
                            border: '1px solid var(--border-color)',
                            fontSize: '15px'
                        }}
                    />
                </div>
            </div>

            {/* List */}
            <div className="px-5">
                <div className="flex flex-col gap-3">
                    {filteredManuales.map((manual) => (
                        <div
                            key={manual.id}
                            className="p-4 rounded-2xl flex flex-col justify-between"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                            }}
                        >
                            <div className="mb-3">
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium inline-block mb-2" style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759' }}>
                                    {manual.cargo}
                                </span>
                                <h3 className="font-bold leading-tight" style={{ fontSize: '17px', color: 'var(--label-primary)' }}>
                                    {manual.titulo}
                                </h3>
                                <p className="text-xs mt-1" style={{ color: 'var(--label-tertiary)' }}>
                                    Última revisión: {manual.revision}
                                </p>
                            </div>
                            
                            <button
                                className="w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center transition-opacity active:opacity-70"
                                style={{
                                    background: 'rgba(0,122,255,0.1)',
                                    color: '#007AFF',
                                    border: '1px solid rgba(0,122,255,0.2)'
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                                Ver Documento
                            </button>
                        </div>
                    ))}
                    
                    {filteredManuales.length === 0 && (
                        <div className="text-center py-8" style={{ color: 'var(--label-tertiary)' }}>
                            No se encontraron manuales.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
