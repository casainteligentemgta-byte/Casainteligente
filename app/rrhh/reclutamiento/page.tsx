'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ReclutamientoPage() {
    const router = useRouter();
    const supabase = createClient();

    const [tipoTrabajador, setTipoTrabajador] = useState<string>('');
    const [cargo, setCargo] = useState<string>('');
    const [nombre, setNombre] = useState<string>('');
    const [celular, setCelular] = useState<string>('');
    const [linkGenerado, setLinkGenerado] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Datos simulados
    const cargosEmpleado = ['Gerente General', 'Vendedor', 'Asesor Técnico', 'Administrador'];
    const cargosObrero = ['Maestro de Obra', 'Albañil', 'Ayudante', 'Electricista'];

    const cargosDisponibles = tipoTrabajador === 'empleado' ? cargosEmpleado : tipoTrabajador === 'obrero' ? cargosObrero : [];

    const generarLink = async () => {
        if (!tipoTrabajador || !cargo || !nombre || !celular) return;
        
        setIsGenerating(true);
        setError(null);

        try {
            const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
            
            const { data, error: insertError } = await supabase
                .from('ci_empleados')
                .insert([
                    {
                        nombres: nombre,
                        celular: celular,
                        cargo: cargo,
                        token: token,
                        estado_proceso: 'prospecto_invitado'
                    }
                ]);

            if (insertError) throw insertError;

            // setLinkGenerado(`https://app.casainteligente.com/onboarding/hoja-de-vida/${token}`);
            setLinkGenerado(`${window.location.origin}/onboarding/hoja-de-vida/${token}`);
        } catch (err: any) {
            console.error(err);
            setError('Error al generar enlace: ' + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)', paddingBottom: '100px' }}>
            {/* Header */}
            <div className="px-5 pt-14 pb-4">
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
                <div className="flex items-center justify-between">
                    <h1 className="font-bold tracking-tight leading-tight" style={{ fontSize: '32px', color: 'var(--label-primary)' }}>
                        Reclutamiento
                    </h1>
                </div>
                <p className="mt-1 text-sm mb-4" style={{ color: 'var(--label-secondary)' }}>
                    Genera enlaces de contratación digital para nuevos candidatos.
                </p>
            </div>

            {/* Formulario */}
            <div className="px-5">
                <div className="p-5 rounded-2xl mb-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    
                    {error && (
                        <div className="p-3 mb-4 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium border border-red-500/20">
                            {error}
                        </div>
                    )}

                    {/* Nombre y Celular */}
                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2" style={{ color: 'var(--label-primary)' }}>Datos del Candidato</label>
                        <input 
                            type="text"
                            placeholder="Nombre Completo"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="w-full p-3 rounded-xl outline-none mb-3"
                            style={{ background: 'var(--bg-primary)', color: 'var(--label-primary)', border: '1px solid var(--border-color)' }}
                        />
                        <input 
                            type="tel"
                            placeholder="Teléfono Celular"
                            value={celular}
                            onChange={(e) => setCelular(e.target.value)}
                            className="w-full p-3 rounded-xl outline-none"
                            style={{ background: 'var(--bg-primary)', color: 'var(--label-primary)', border: '1px solid var(--border-color)' }}
                        />
                    </div>

                    {/* Tipo de Trabajador */}
                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2" style={{ color: 'var(--label-primary)' }}>Tipo de Contratación</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => { setTipoTrabajador('empleado'); setCargo(''); setLinkGenerado(''); }}
                                className="py-3 rounded-xl text-sm font-medium transition-colors"
                                style={{
                                    background: tipoTrabajador === 'empleado' ? 'rgba(0,122,255,0.1)' : 'var(--bg-primary)',
                                    color: tipoTrabajador === 'empleado' ? '#007AFF' : 'var(--label-secondary)',
                                    border: tipoTrabajador === 'empleado' ? '1px solid rgba(0,122,255,0.3)' : '1px solid var(--border-color)'
                                }}
                            >
                                Empleado
                            </button>
                            <button 
                                onClick={() => { setTipoTrabajador('obrero'); setCargo(''); setLinkGenerado(''); }}
                                className="py-3 rounded-xl text-sm font-medium transition-colors"
                                style={{
                                    background: tipoTrabajador === 'obrero' ? 'rgba(255,149,0,0.1)' : 'var(--bg-primary)',
                                    color: tipoTrabajador === 'obrero' ? '#FF9500' : 'var(--label-secondary)',
                                    border: tipoTrabajador === 'obrero' ? '1px solid rgba(255,149,0,0.3)' : '1px solid var(--border-color)'
                                }}
                            >
                                Obrero
                            </button>
                        </div>
                    </div>

                    {/* Cargo */}
                    {tipoTrabajador && (
                        <div className="mb-5 animate-fade-in">
                            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--label-primary)' }}>Seleccionar Cargo</label>
                            <select 
                                value={cargo}
                                onChange={(e) => { setCargo(e.target.value); setLinkGenerado(''); }}
                                className="w-full p-3 rounded-xl outline-none"
                                style={{
                                    background: 'var(--bg-primary)',
                                    color: 'var(--label-primary)',
                                    border: '1px solid var(--border-color)',
                                    appearance: 'none'
                                }}
                            >
                                <option value="" disabled>Selecciona un cargo...</option>
                                {cargosDisponibles.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Botón Generar */}
                    <button
                        onClick={generarLink}
                        disabled={!tipoTrabajador || !cargo || !nombre || !celular || isGenerating}
                        className="w-full py-3.5 rounded-xl font-bold text-white transition-opacity disabled:opacity-50 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)', boxShadow: '0 4px 12px rgba(0,122,255,0.3)' }}
                    >
                        {isGenerating ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                        )}
                        {isGenerating ? 'Generando...' : 'Generar Enlace Único'}
                    </button>
                </div>

                {/* Resultado Generado */}
                {linkGenerado && (
                    <div className="p-5 rounded-2xl mb-6 animate-fade-in" style={{ background: 'rgba(52,199,89,0.05)', border: '1px solid rgba(52,199,89,0.2)' }}>
                        <h3 className="font-bold mb-3 flex items-center" style={{ color: '#34C759' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            ¡Enlace Generado!
                        </h3>
                        
                        <div className="mb-4">
                            <p className="text-xs font-bold mb-1" style={{ color: 'var(--label-secondary)' }}>CARGO A POSTULAR:</p>
                            <p className="font-medium text-sm" style={{ color: 'var(--label-primary)' }}>{cargo}</p>
                        </div>

                        {/* QR Code Placeholder */}
                        <div className="flex justify-center mb-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200">
                                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter">
                                    <rect x="3" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="3" width="7" height="7"></rect>
                                    <rect x="3" y="14" width="7" height="7"></rect>
                                    <rect x="14" y="14" width="3" height="3"></rect>
                                    <rect x="18" y="18" width="3" height="3"></rect>
                                    <rect x="14" y="18" width="3" height="3"></rect>
                                    <rect x="18" y="14" width="3" height="3"></rect>
                                    <path d="M6 6h1v1H6zM17 6h1v1h-1zM6 17h1v1H6zM10 14h2v2h-2zM10 18h2v2h-2zM12 16h2v2h-2z"></path>
                                </svg>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl mb-4 text-xs font-mono break-all" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--label-primary)' }}>
                            {linkGenerado}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button className="py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center transition-opacity active:opacity-70" style={{ background: '#25D366' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                </svg>
                                WhatsApp
                            </button>
                            <button className="py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center transition-opacity active:opacity-70" style={{ background: '#007AFF' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                                Email
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
