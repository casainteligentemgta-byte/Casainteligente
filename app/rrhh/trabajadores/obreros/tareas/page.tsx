'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Datos de ejemplo
const tareas = [
    { id: 1, categoria: 'Albañil', titulo: 'Preparación de mezcla', detalle: 'Preparar mezcla de concreto según proporciones.', frecuencia: 'Diaria' },
    { id: 2, categoria: 'Maestro de Obra', titulo: 'Lectura de Planos', detalle: 'Interpretar y ejecutar las obras según planos técnicos.', frecuencia: 'Según Proyecto' },
    { id: 3, categoria: 'Electricista', titulo: 'Cableado general', detalle: 'Instalación de tuberías y cableado estructurado.', frecuencia: 'Semanal' },
];

export default function TareasPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTareas = tareas.filter(t => 
        t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.categoria.toLowerCase().includes(searchTerm.toLowerCase())
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
                        Tareas Específicas
                    </h1>
                </div>
                <p className="mt-1 text-sm mb-4" style={{ color: 'var(--label-secondary)' }}>
                    Asignación y descripción de tareas por oficio.
                </p>

                {/* Buscador */}
                <div className="relative">
                    <svg className="absolute left-3 top-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--label-tertiary)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        placeholder="Buscar tarea u oficio..."
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
                    {filteredTareas.map((tarea) => (
                        <div
                            key={tarea.id}
                            className="p-4 rounded-2xl flex flex-col justify-between"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                            }}
                        >
                            <div className="mb-2">
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium inline-block mb-2" style={{ background: 'rgba(255,149,0,0.1)', color: '#FF9500' }}>
                                    {tarea.categoria}
                                </span>
                                <h3 className="font-bold leading-tight" style={{ fontSize: '18px', color: 'var(--label-primary)' }}>
                                    {tarea.titulo}
                                </h3>
                            </div>
                            <p className="text-sm mt-1 mb-3" style={{ color: 'var(--label-secondary)' }}>
                                {tarea.detalle}
                            </p>
                            <div className="flex items-center text-xs font-medium" style={{ color: 'var(--label-tertiary)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                Frecuencia: {tarea.frecuencia}
                            </div>
                        </div>
                    ))}
                    
                    {filteredTareas.length === 0 && (
                        <div className="text-center py-8" style={{ color: 'var(--label-tertiary)' }}>
                            No se encontraron tareas.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
