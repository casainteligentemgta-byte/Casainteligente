'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Datos de ejemplo
const evaluaciones = [
    { id: 1, titulo: 'Test de Habilidades Técnicas', cargoDestino: 'Asesor Técnico', duracion: '30 min', preguntas: 15 },
    { id: 2, titulo: 'Evaluación Psicológica Básica', cargoDestino: 'General', duracion: '45 min', preguntas: 40 },
    { id: 3, titulo: 'Test de Técnicas de Cierre', cargoDestino: 'Vendedor', duracion: '20 min', preguntas: 10 },
];

export default function EvaluacionesPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredEvaluaciones = evaluaciones.filter(e => 
        e.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.cargoDestino.toLowerCase().includes(searchTerm.toLowerCase())
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
                        Evaluaciones
                    </h1>
                    <button
                        className="rounded-full w-10 h-10 flex items-center justify-center text-white"
                        style={{ background: 'linear-gradient(135deg, #FF9500, #ffaa33)', boxShadow: '0 4px 12px rgba(255,149,0,0.3)' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
                <p className="mt-1 text-sm mb-4" style={{ color: 'var(--label-secondary)' }}>
                    Tests de aptitud y cuestionarios para personal.
                </p>

                {/* Buscador */}
                <div className="relative">
                    <svg className="absolute left-3 top-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--label-tertiary)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        placeholder="Buscar test o cargo..."
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
                    {filteredEvaluaciones.map((test) => (
                        <div
                            key={test.id}
                            className="p-4 rounded-2xl"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                            }}
                        >
                            <div className="mb-3">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-bold leading-tight" style={{ fontSize: '17px', color: 'var(--label-primary)', paddingRight: '8px' }}>
                                        {test.titulo}
                                    </h3>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ background: 'rgba(255,149,0,0.1)', color: '#FF9500' }}>
                                        {test.cargoDestino}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--label-secondary)' }}>
                                    <div className="flex items-center">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <polyline points="12 6 12 12 16 14"></polyline>
                                        </svg>
                                        {test.duracion}
                                    </div>
                                    <div className="flex items-center">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                            <polyline points="10 9 9 9 8 9"></polyline>
                                        </svg>
                                        {test.preguntas} pts.
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <button
                                    className="py-2 rounded-xl font-medium text-sm flex items-center justify-center transition-opacity active:opacity-70"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        color: 'var(--label-secondary)',
                                        border: '1px solid var(--border-color)'
                                    }}
                                >
                                    Editar
                                </button>
                                <button
                                    className="py-2 rounded-xl font-medium text-sm flex items-center justify-center transition-opacity active:opacity-70"
                                    style={{
                                        background: '#FF9500',
                                        color: 'white',
                                        boxShadow: '0 2px 8px rgba(255,149,0,0.3)'
                                    }}
                                >
                                    Ver Resultados
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {filteredEvaluaciones.length === 0 && (
                        <div className="text-center py-8" style={{ color: 'var(--label-tertiary)' }}>
                            No se encontraron evaluaciones.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
