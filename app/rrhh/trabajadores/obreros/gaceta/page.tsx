'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Datos de ejemplo
const oficios = [
    { id: 1, titulo: 'Maestro de Obra', categoria: 'Especializado', trabajadores: 2 },
    { id: 2, titulo: 'Albañil', categoria: 'Primera', trabajadores: 5 },
    { id: 3, titulo: 'Ayudante', categoria: 'Segunda', trabajadores: 8 },
    { id: 4, titulo: 'Electricista', categoria: 'Especializado', trabajadores: 1 },
];

export default function GacetaPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOficios = oficios.filter(o => 
        o.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        o.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                        Clasificación / Gaceta
                    </h1>
                    <button
                        className="rounded-full w-10 h-10 flex items-center justify-center text-white flex-shrink-0 ml-2"
                        style={{ background: 'linear-gradient(135deg, #34C759, #30b350)', boxShadow: '0 4px 12px rgba(52,199,89,0.3)' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
                <p className="mt-1 text-sm mb-4" style={{ color: 'var(--label-secondary)' }}>
                    Oficios listados según convención colectiva.
                </p>

                {/* Buscador */}
                <div className="relative">
                    <svg className="absolute left-3 top-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--label-tertiary)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        placeholder="Buscar oficio o categoría..."
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
                    {filteredOficios.map((oficio) => (
                        <div
                            key={oficio.id}
                            className="p-4 rounded-2xl flex flex-col justify-between"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                            }}
                        >
                            <div className="mb-2">
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium inline-block mb-2" style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759' }}>
                                    {oficio.categoria}
                                </span>
                                <h3 className="font-bold leading-tight" style={{ fontSize: '18px', color: 'var(--label-primary)' }}>
                                    {oficio.titulo}
                                </h3>
                            </div>
                            <div className="flex items-center text-sm mt-2" style={{ color: 'var(--label-secondary)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                {oficio.trabajadores} trabajador(es) asignado(s)
                            </div>
                        </div>
                    ))}
                    
                    {filteredOficios.length === 0 && (
                        <div className="text-center py-8" style={{ color: 'var(--label-tertiary)' }}>
                            No se encontraron oficios.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
